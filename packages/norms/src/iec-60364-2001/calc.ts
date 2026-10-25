import type { ConductorImpedanceQuery, MotorFlcQuery, NormCalc } from "@rea/engine";
import { getNormDataset } from "@rea/norm-data";
import { iecMethod } from "./methods";

export const iecData = () => getNormDataset("iec-60364", "2001");

/** Cita corta para la memoria: tabla de la fuente secundaria y parte de la norma. */
export const SRC = "IEC 60364 vía ABB EIH Vol. 2 4.ª ed. (fuente secundaria)";

/**
 * IEC 60364 no tabula corrientes de motores: se usa la corriente nominal de placa del fabricante.
 * (La fuente da una tabla aproximada «solo informativa» para motores de 4 polos a 50 Hz; no se usa
 * para dimensionar.)
 */
function motorFlc(q: MotorFlcQuery): ReturnType<NormCalc["motorFlc"]> {
  return {
    ok: false,
    error: `IEC 60364 no tiene tabla de corrientes de motores (${q.ratedPower} ${q.ratedPowerUnit}): capture la corriente nominal de placa (fuente de corriente = placa).`,
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
