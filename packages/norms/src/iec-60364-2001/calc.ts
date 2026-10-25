import type { ConductorImpedanceQuery, MotorFlcQuery, NormCalc } from "@rea/engine";
import { getNormDataset } from "@rea/norm-data";
import { iecMethod } from "./methods";

export const iecData = () => getNormDataset("iec-60364", "2001");

/** Cita corta para la memoria: tabla de la fuente secundaria y parte de la norma. */
export const SRC = "IEC 60364 vía ABB EIH Vol. 2 4.ª ed. (fuente secundaria)";

/** "1/12" → 0.0833; "3.4" → 3.4. */
const psToNumber = (s: string) => (s.includes("/") ? Number(s.split("/")[0]) / Number(s.split("/")[1]) : Number(s));

/** Columnas de la tabla que la fuente publica como intervalos de tensión. */
const VOLTAGE_RANGES: [number, number, number][] = [
  [220, 230, 230],
  [380, 400, 400],
  [660, 690, 690],
];

/**
 * IEC 60364 no tabula corrientes de motores: lo correcto es la corriente nominal de placa.
 * Si no se capturó, se usa la tabla aproximada de la fuente (ABB, Anexo B, Tabla 5: motores de
 * jaula de 4 polos a 50 Hz, «solo informativa») con una advertencia en las observaciones.
 */
function motorFlc(q: MotorFlcQuery): ReturnType<NormCalc["motorFlc"]> {
  const ask = "capture la corriente nominal de placa (fuente de corriente = placa)";
  if (q.phases !== "3F") return { ok: false, error: `IEC 60364 no tiene tabla de corrientes para motores ${q.phases === "1F" ? "monofásicos" : "de c.c."}; ${ask}.` };
  const t = iecData().table("anexo-b-tabla-5-motores", "motor-flc");
  const g = t.data.groups[0]!;
  const row = q.ratedPowerUnit === "kW" ? t.data.rows.find((r) => Math.abs(r.kW - q.ratedPower) < 1e-6) : t.data.rows.find((r) => Math.abs(psToNumber(r.hp) - q.ratedPower) < 1e-6);
  if (!row) return { ok: false, error: `${q.ratedPower} ${q.ratedPowerUnit} no está en la tabla aproximada de motores de la fuente; ${ask}.` };
  const exact = g.voltagesV.includes(q.voltageV) ? q.voltageV : VOLTAGE_RANGES.find(([lo, hi]) => q.voltageV >= lo && q.voltageV <= hi)?.[2];
  if (exact === undefined) return { ok: false, error: `La tabla aproximada de motores no tiene columna para ${q.voltageV} V (${g.voltagesV.join(", ")} V); ${ask}.` };
  const amps = row.currentsA[g.id]?.[g.voltagesV.indexOf(exact)] ?? null;
  if (amps === null) return { ok: false, error: `La tabla aproximada no da corriente para ${row.kW} kW a ${exact} V; ${ask}.` };
  return {
    ok: true,
    amps,
    tableVoltageV: exact,
    hp: row.hp,
    refs: [`${SRC}, ${t.reference.table}`],
    notes: [`Valor aproximado para motor de jaula de 4 polos (1500 rpm) a 50 Hz: ${row.kW} kW / ${row.hp} PS. La fuente lo da solo como información.`],
    warnings: [`corriente de motor tomada de la tabla aproximada de la fuente (${amps} A para ${row.kW} kW a ${exact} V, 4 polos, 50 Hz); IEC usa la corriente de placa: captúrela para un cálculo definitivo.`],
  };
}

/**
 * R a 80 °C y X a 50 Hz por unidad de longitud (ABB cap. 2.2.2, Tablas 1 y 2). Para 60 Hz la
 * fuente indica multiplicar la reactancia por 1.2; para otras frecuencias se escala con f/50.
 */
function conductorImpedance(q: ConductorImpedanceQuery): ReturnType<NormCalc["conductorImpedance"]> {
  const m = iecMethod(q.installationMethod);
  if (!m) return { ok: false, error: `Método de instalación IEC desconocido "${q.installationMethod}".` };
  const t = iecData().table(q.material === "Cu" ? "tabla-1-impedancia-cu" : "tabla-2-impedancia-al", "cable-impedance");
  const s = Number(q.designation);
  const row = t.data.rows.find((r) => Math.abs(r.sizeMm2 - s) < 1e-9);
  if (!row) return { ok: false, error: `${t.reference.table} no da R y X para ${q.designation} mm² (la fuente llega a 300 mm²); no se puede calcular la caída de tensión.` };
  const v = m.cable === "unipolar" ? row.singleCore : row.multiCore;
  const f = q.frequencyHz ?? t.data.frequencyHz;
  const factor = f === 60 ? 1.2 : f / t.data.frequencyHz;
  const notes = [`R a ${t.data.temperatureC} °C; X de la tabla a ${t.data.frequencyHz} Hz.`];
  if (f !== t.data.frequencyHz) notes.push(f === 60 ? `Sistema de 60 Hz: X × 1.2 (indicación de la fuente): ${v.xOhmPerKm} × 1.2.` : `Sistema de ${f} Hz: X × ${f}/${t.data.frequencyHz}.`);
  return {
    ok: true,
    rOhmPerKm: v.rOhmPerKm,
    xOhmPerKm: Number((v.xOhmPerKm * factor).toFixed(5)),
    column: m.cable === "unipolar" ? "cable unipolar" : "cable multiconductor",
    temperatureC: t.data.temperatureC,
    refs: [`${SRC}, ${t.reference.table}`],
    notes,
  };
}

export const iecCalc: NormCalc = { motorFlc, conductorImpedance };
