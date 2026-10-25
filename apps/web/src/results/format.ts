// Importa solo el módulo de datos (sin las bibliotecas de PDF y Excel).
import { fmt, resultBadge as badgeOf } from "@rea/reports/src/data";
import type { Results } from "../state/validation";

export const f1 = fmt;

/** Resumen corto de resultados junto al símbolo; es el mismo texto que lleva el unifilar exportado. */
export function resultBadge(elementId: string, type: string, results: Results): string[] {
  return badgeOf(elementId, type, results.sizing);
}
