import type { ConductorImpedanceQuery, MotorFlcQuery, NormCalc } from "@rea/engine";
import { getNormDataset } from "@rea/norm-data";
import { transformerLoadLosses } from "../transformer-losses";
import { racewayMethod } from "./raceways";

const data = () => getNormDataset("nom-001-sede", "2012");

/** "1 1/2" → 1.5; "1/6" → 0.1667. */
export function hpToNumber(hp: string): number {
  return hp.split(" ").reduce((s, part) => {
    const [a, b] = part.split("/");
    return s + (b ? Number(a) / Number(b) : Number(a));
  }, 0);
}

/**
 * Columna de tensión de las tablas de motores. Las notas de las Tablas 430-248 y 430-250
 * permiten usar las corrientes listadas para sistemas de 110–120, 220–240, 440–480 y 550–600 V.
 */
function tableVoltage(v: number, columns: number[]): { col: number; note?: string } | null {
  if (columns.includes(v)) return { col: v };
  const ranges: [number, number, number][] = [
    [110, 120, 115],
    [220, 240, 230],
    [440, 480, 460],
    [550, 600, 575],
  ];
  for (const [lo, hi, col] of ranges) {
    if (v >= lo && v <= hi && columns.includes(col)) {
      return { col, note: `Tensión del motor ${v} V: se usa la columna de ${col} V (intervalo de ${lo} a ${hi} V permitido por la nota de la tabla).` };
    }
  }
  return null;
}

function motorFlc(q: MotorFlcQuery): ReturnType<NormCalc["motorFlc"]> {
  const tableId = q.phases === "3F" ? "tabla-430-250" : q.phases === "1F" ? "tabla-430-248" : "tabla-430-247";
  const t = data().table(tableId, "motor-flc");
  const group = q.phases === "3F" ? (q.synchronous ? "sincrono-fp1" : "induccion") : t.data.groups[0]!.id;
  const g = t.data.groups.find((x) => x.id === group)!;

  const row =
    q.ratedPowerUnit === "hp"
      ? t.data.rows.find((r) => Math.abs(hpToNumber(r.hp) - q.ratedPower) < 1e-6)
      : t.data.rows.find((r) => Math.abs(r.kW - q.ratedPower) < 1e-6);
  if (!row) {
    return { ok: false, error: `${q.ratedPower} ${q.ratedPowerUnit} no está en la ${t.reference.table}; use la corriente de placa.` };
  }
  const tv = tableVoltage(q.voltageV, g.voltagesV);
  if (!tv) return { ok: false, error: `La ${t.reference.table} no tiene columna para ${q.voltageV} V; use la corriente de placa.` };
  const amps = row.currentsA[group]?.[g.voltagesV.indexOf(tv.col)] ?? null;
  if (amps === null) return { ok: false, error: `La ${t.reference.table} no da corriente para ${row.hp} hp a ${tv.col} V; use la corriente de placa.` };

  const notes = tv.note ? [tv.note] : [];
  if (q.synchronous) notes.push("Motor síncrono: valores para factor de potencia unitario; para FP 0.9 y 0.8 multiplicar por 1.10 y 1.25 (nota de la tabla).");
  const errata = t.errata.find((e) => e.path.startsWith(`rows[${t.data.rows.indexOf(row)}].currentsA.${group}[${g.voltagesV.indexOf(tv.col)}]`));
  if (errata) notes.push(`Valor corregido por errata aprobada: publicado ${errata.asPublished} A, se usa ${errata.corrected} A.`);
  return { ok: true, amps, tableVoltageV: tv.col, hp: row.hp, refs: [data().cite(tableId, "NOM-001-SEDE-2012"), "430-6(a)(1)"], notes };
}

function conductorImpedance(q: ConductorImpedanceQuery): ReturnType<NormCalc["conductorImpedance"]> {
  const method = racewayMethod(q.installationMethod);
  if (!method) return { ok: false, error: `Método de instalación desconocido "${q.installationMethod}".` };
  const t9 = data().table("cap10-tabla-9", "ac-impedance");
  const row = t9.data.rows.find((r) => r.designation === q.designation);
  if (!row) return { ok: false, error: `La Tabla 9 no incluye el calibre ${q.designation}; no se puede calcular la impedancia.` };
  const col = method.impedanceColumn;
  const r = (q.material === "Cu" ? row.rCuOhmPerKm : row.rAlOhmPerKm)[col];
  const x = col === "acero" ? row.xlOhmPerKm.acero : row.xlOhmPerKm.pvcOAluminio;
  if (r === null) return { ok: false, error: `La Tabla 9 no da resistencia de ${q.material === "Cu" ? "cobre" : "aluminio"} ${q.designation} en conduit de ${col}.` };
  const columnLabel = { pvc: "conduit de PVC", aluminio: "conduit de aluminio", acero: "conduit de acero" }[col];
  return {
    ok: true,
    rOhmPerKm: r,
    xOhmPerKm: x,
    column: columnLabel,
    temperatureC: t9.data.temperatureC,
    refs: [data().cite("cap10-tabla-9", "NOM-001-SEDE-2012")],
    notes: method.impedanceAssumption ? [method.impedanceAssumption] : [],
  };
}

export const nomCalc: NormCalc = { motorFlc, conductorImpedance, transformerLoadLosses };
