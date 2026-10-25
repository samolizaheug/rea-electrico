/**
 * Trazas de memoria de cálculo. Cada resultado del motor lleva los pasos con que se obtuvo:
 * fórmula, valores sustituidos, resultado y referencias normativas, de modo que pueda
 * verificarse a mano.
 */
export interface TraceStep {
  /** Qué se calcula, p. ej. "Corriente del motor". */
  label: string;
  /** Fórmula simbólica, p. ej. "I = S / (√3 · V)". */
  formula?: string;
  /** Fórmula con valores sustituidos, p. ej. "I = 51 787 / (√3 · 460)". */
  substitution?: string;
  /** Resultado con unidades, p. ej. "65.0 A". */
  result: string;
  /** Tablas, artículos o supuestos aplicados. */
  refs?: string[];
}

export interface Trace {
  title: string;
  steps: TraceStep[];
}

/** Formato numérico para memorias: separador de miles con espacio fino, punto decimal. */
export function fmtNum(v: number, decimals = 2): string {
  const s = v.toFixed(decimals);
  const [int, dec] = s.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${grouped}.${dec}` : grouped;
}
