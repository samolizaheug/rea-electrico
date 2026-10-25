/**
 * Métodos de instalación de referencia de IEC 60364-5-52:2001, con la descripción de los
 * ejemplos de la Tabla 3 de la fuente (ABB, cap. 2.2.1, pp. 30–33 del PDF).
 *
 * - `method`: columna de la tabla de ampacidad (A1, A2, B1, B2, C, D, E, F, G).
 * - `cable`: unipolar o multiconductor; define la columna de R y X (Tablas 1 y 2 del cap. 2.2.2).
 * - `arrangement`: disposición en F (trébol o plano) y G (horizontal o vertical) para 3 conductores cargados.
 * - `grouping`: renglón de la Tabla 5 para el factor k2 (null = cables separados, sin factor: nota 2).
 */
export interface IecMethod {
  value: string;
  label: string;
  group: string;
  method: "A1" | "A2" | "B1" | "B2" | "C" | "D" | "E" | "F" | "G";
  cable: "unipolar" | "multiconductor";
  arrangement?: "trebol" | "plano" | "horizontal" | "vertical";
  grouping: "1" | "2" | "4" | "5" | null;
  /** Ítems de la Tabla 3 que corresponden. */
  items: string;
}

const EMBEBIDO = "En pared o tubo";
const SUPERFICIE = "Sobre superficie";
const ENTERRADO = "Enterrado";
const AIRE = "Al aire libre";

export const IEC_METHODS: IecMethod[] = [
  { value: "A1", group: EMBEBIDO, method: "A1", cable: "unipolar", grouping: "1", items: "1", label: "A1 — Conductores aislados o cables unipolares en tubo dentro de pared térmicamente aislante" },
  { value: "A2", group: EMBEBIDO, method: "A2", cable: "multiconductor", grouping: "1", items: "2", label: "A2 — Cable multiconductor en tubo dentro de pared térmicamente aislante" },
  { value: "B1", group: EMBEBIDO, method: "B1", cable: "unipolar", grouping: "1", items: "4, 59", label: "B1 — Conductores aislados o unipolares en tubo sobre pared o en mampostería" },
  { value: "B1-canaleta", group: SUPERFICIE, method: "B1", cable: "unipolar", grouping: "1", items: "6, 7", label: "B1 — Conductores aislados o unipolares en canaleta sobre pared" },
  { value: "B2", group: EMBEBIDO, method: "B2", cable: "multiconductor", grouping: "1", items: "5, 60", label: "B2 — Cable multiconductor en tubo sobre pared o en mampostería" },
  { value: "C", group: SUPERFICIE, method: "C", cable: "multiconductor", grouping: "2", items: "20, 30", label: "C — Cable multiconductor fijado sobre pared o en charola sin perforar" },
  { value: "C-unipolar", group: SUPERFICIE, method: "C", cable: "unipolar", grouping: "2", items: "20, 30", label: "C — Cables unipolares fijados sobre pared o en charola sin perforar" },
  { value: "D", group: ENTERRADO, method: "D", cable: "multiconductor", grouping: "1", items: "70", label: "D — Cable multiconductor en tubo o ducto enterrado" },
  { value: "D-unipolar", group: ENTERRADO, method: "D", cable: "unipolar", grouping: "1", items: "71", label: "D — Cables unipolares en tubo o ducto enterrado" },
  { value: "E", group: AIRE, method: "E", cable: "multiconductor", grouping: "4", items: "31, 32", label: "E — Cable multiconductor en charola perforada o ménsulas" },
  { value: "E-escalera", group: AIRE, method: "E", cable: "multiconductor", grouping: "5", items: "34", label: "E — Cable multiconductor en charola tipo escalera" },
  { value: "F-trebol", group: AIRE, method: "F", cable: "unipolar", arrangement: "trebol", grouping: "4", items: "31, 32", label: "F — Cables unipolares en trébol, en charola perforada o ménsulas" },
  { value: "F-plano", group: AIRE, method: "F", cable: "unipolar", arrangement: "plano", grouping: "4", items: "31, 32", label: "F — Cables unipolares en plano y en contacto, en charola perforada o ménsulas" },
  { value: "F-escalera", group: AIRE, method: "F", cable: "unipolar", arrangement: "trebol", grouping: "5", items: "34", label: "F — Cables unipolares en trébol, en charola tipo escalera" },
  { value: "G-horizontal", group: AIRE, method: "G", cable: "unipolar", arrangement: "horizontal", grouping: null, items: "33, 36", label: "G — Cables unipolares separados, en plano horizontal" },
  { value: "G-vertical", group: AIRE, method: "G", cable: "unipolar", arrangement: "vertical", grouping: null, items: "33, 36", label: "G — Cables unipolares separados, en plano vertical" },
];

export function iecMethod(value: unknown): IecMethod | undefined {
  return IEC_METHODS.find((m) => m.value === value);
}
