import type { NormCalc, TransformerLossQuery } from "@rea/engine";
import { perdidasTransformadorDistribucion } from "@rea/norm-data";

/**
 * Pérdidas debidas a la carga típicas de un transformador de distribución, a partir de las pérdidas
 * máximas de la NOM-002-SEDE-2010 Tabla 2 (totales − en vacío). Es una estimación: el resultado se
 * marca como dato aproximado para que el diseñador lo sustituya por el dato de placa.
 */
export function transformerLoadLosses(q: TransformerLossQuery): ReturnType<NonNullable<NormCalc["transformerLoadLosses"]>> {
  const p = perdidasTransformadorDistribucion(q.phases, q.ratedKVA, q.primaryVoltageV);
  if (!p) {
    return {
      ok: false,
      error: `no hay valor típico para ${q.ratedKVA} kVA ${q.phases === 1 ? "monofásico" : "trifásico"} con primario de ${q.primaryVoltageV} V (la NOM-002-SEDE-2010 Tabla 2 llega a ${q.phases === 1 ? "167" : "500"} kVA y clase 34,5 kV); capture la relación X/R o las pérdidas en carga de placa.`,
    };
  }
  const warnings = [
    `X/R estimada con las pérdidas máximas de la NOM-002-SEDE-2010 (${p.kvaTabla} kVA, NBA ${p.nbaKV} kV); sustitúyala por el dato de placa o del protocolo de pruebas.`,
  ];
  if (p.fueraDeAlcance) warnings.push(`El primario es de baja tensión: la NOM-002-SEDE-2010 no aplica; se usó la columna de NBA 95 kV solo como estimación.`);
  const notes = [];
  if (p.kvaTabla !== q.ratedKVA) notes.push(`Capacidad intermedia: se usan las pérdidas de ${p.kvaTabla} kVA (nota 3 de la tabla).`);
  return {
    ok: true,
    lossW: p.cargaW,
    tableKVA: p.kvaTabla,
    column: `NBA ${p.nbaKV} kV`,
    substitution: `P carga = ${p.totalesW} − ${p.vacioW} = ${p.cargaW} W`,
    refs: [p.cita],
    notes,
    warnings,
  };
}
