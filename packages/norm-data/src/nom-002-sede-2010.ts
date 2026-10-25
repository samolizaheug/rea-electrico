/**
 * Consultas tipadas a la NOM-002-SEDE-2010 (transformadores de distribución, DOF).
 * Se usa para estimar las pérdidas debidas a la carga cuando no hay X/R ni pérdidas de placa.
 */
import { getNormDataset } from "./index";

const ds = () => getNormDataset("nom-002-sede", "2010");

export interface PerdidasTransformador {
  /** Capacidad del renglón usado (la preferente inmediata superior si la capacidad es intermedia, nota 3). */
  kvaTabla: number;
  /** Nivel básico de aislamiento de la columna usada (kV). */
  nbaKV: 95 | 150 | 200;
  vacioW: number;
  totalesW: number;
  /** Pérdidas debidas a la carga = totales − en vacío (nota 2). */
  cargaW: number;
  /** El primario está fuera del alcance de la norma (baja tensión): se usó la columna de 95 kV como estimación. */
  fueraDeAlcance: boolean;
  cita: string;
}

/**
 * Pérdidas máximas de la Tabla 2 para un transformador de distribución.
 * Devuelve null si la capacidad pasa de la tabla (más de 167 kVA monofásico o 500 kVA trifásico)
 * o si el primario pasa de la clase 34,5 kV.
 */
export function perdidasTransformadorDistribucion(fases: 1 | 3, kva: number, tensionPrimariaV: number): PerdidasTransformador | null {
  if (!(kva > 0) || !(tensionPrimariaV > 0) || tensionPrimariaV > 34500) return null;
  const tipo = fases === 1 ? "monofasico" : "trifasico";
  const renglones = ds()
    .table("tabla-2", "rows-table")
    .data.rows.filter((r) => r.tipo === tipo)
    .sort((a, b) => Number(a.kva) - Number(b.kva));
  const r = renglones.find((x) => Number(x.kva) >= kva - 1e-9);
  if (!r) return null;
  const nbaKV = tensionPrimariaV <= 15000 ? 95 : tensionPrimariaV <= 25000 ? 150 : 200;
  const vacioW = Number(r[`vacio_${nbaKV}`]);
  const totalesW = Number(r[`totales_${nbaKV}`]);
  const t = ds().table("tabla-2");
  return {
    kvaTabla: Number(r.kva),
    nbaKV,
    vacioW,
    totalesW,
    cargaW: totalesW - vacioW,
    fueraDeAlcance: tensionPrimariaV < 1000,
    cita: `NOM-002-SEDE-2010 ${t.reference.table} (${t.reference.title}), numeral ${t.reference.article}`,
  };
}
