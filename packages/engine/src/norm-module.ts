import type { EnumOption, ParamValue } from "@rea/core";

/**
 * Contrato de un módulo normativo. El motor y la interfaz solo conocen esta interfaz;
 * cada norma (NOM-001-SEDE, NEC, IEC 60364) la implementa en el paquete @rea/norms.
 * En etapas siguientes se agregan aquí los criterios de cálculo (ampacidad, protección, tierra...).
 */
export interface NormModule {
  id: string;
  edition: string;
  /** Nombre para mostrar, p. ej. "NOM-001-SEDE-2012". */
  label: string;
  /** false si aún no hay tablas capturadas para esta norma/edición. */
  available: boolean;
  unavailableReason?: string;
  /** Opciones de los parámetros con proveedor `norm:*` (aislamientos, métodos de instalación, calibres). */
  options(provider: string): EnumOption[] | undefined;
  /** Valores por defecto que la norma propone al crear un elemento de ese tipo. */
  paramDefaults(type: string): Record<string, ParamValue>;
}

/** Módulo nulo: para normas sin datos. No ofrece opciones ni valores por defecto. */
export function unavailableNormModule(id: string, edition: string, label: string, reason: string): NormModule {
  return { id, edition, label, available: false, unavailableReason: reason, options: () => undefined, paramDefaults: () => ({}) };
}
