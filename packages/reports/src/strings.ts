/**
 * Textos de los reportes. El paquete no depende de la interfaz, así que tiene su propio
 * diccionario; la traducción al inglés se agrega en la etapa E10 con las mismas claves.
 */
export const reportStrings = {
  memoriaTitle: "Memoria de cálculo",
  diagramTitle: "Diagrama unifilar",
  draft: "BORRADOR",
  draftReason: "Hay tablas normativas sin verificar o errores en el proyecto: los resultados son preliminares.",
  page: "Hoja {n} de {total}",
  generated: "Generado",
  disclaimer: "Este documento apoya el diseño y no sustituye la revisión y firma de un ingeniero responsable.",

  secProject: "Datos del proyecto",
  secCriteria: "Criterios de diseño",
  secDiagram: "Diagrama unifilar",
  secCircuits: "Cédula de conductores y protecciones",
  secSchedules: "Cuadros de carga",
  secMemoria: "Memoria de cálculo por elemento",
  secIssues: "Observaciones",
  secTables: "Tablas normativas utilizadas",
  secSignatures: "Firmas",

  name: "Nombre",
  client: "Cliente",
  location: "Ubicación",
  author: "Elaboró",
  reviewed: "Revisó",
  description: "Descripción",
  norm: "Norma",
  frequency: "Frecuencia",
  ambientAir: "Temperatura ambiente (aire)",
  ambientGround: "Temperatura del terreno",
  vdBranch: "Caída máx. en circuito derivado",
  vdFeeder: "Caída máx. en alimentador",
  vdTotal: "Caída máx. total",
  unbalance: "Desbalance máx. entre fases",
  method: "Método de cálculo",
  methodValue: "Nominal (corrientes con la tensión nominal; caída con Ze de la Tabla 9). Es el método de la memoria; el barrido fasorial queda como referencia.",
  symbology: "Simbología",

  circuit: "Circuito",
  from: "Origen",
  to: "Destino",
  kind: "Tipo",
  loadA: "I carga (A)",
  designA: "I diseño (A)",
  protection: "Protección (A)",
  conductor: "Conductor",
  egc: "Tierra",
  ampacity: "Ampacidad (A)",
  length: "L (m)",
  dropPct: "ΔV tramo (%)",
  cumulativePct: "ΔV acum. (%)",
  governing: "Rige",
  "governing.ampacidad": "ampacidad",
  "governing.proteccion": "protección",
  "governing.caida-de-tension": "caída de tensión",
  "governing.fijado": "calibre fijado",

  phases: "Fases",
  total: "Total",
  totals: "Totales",
  phaseCurrent: "Corriente por fase (A)",
  unbalanceShort: "Desbalance",
  limit: "límite",
  fedBy: "Alimenta a",

  current: "Corriente",
  currentSecondary: "Corriente del secundario",
  power: "Potencia",
  voltage: "Tensión",
  drop: "Caída de tensión del tramo",
  cumulative: "Caída acumulada en conductores",
  designCurrent: "Corriente de diseño",
  sizingTrace: "Dimensionamiento",
  protectionTrace: "Selección de la protección",
  formula: "Fórmula",
  substitution: "Sustitución",
  result: "Resultado",
  refs: "Referencias",

  severity: "Tipo",
  message: "Descripción",
  error: "Error",
  warning: "Advertencia",
  info: "Nota",
  noIssues: "Sin observaciones.",

  table: "Tabla",
  article: "Artículo",
  title: "Título",
  status: "Estado",

  element: "Elemento",
  step: "Paso",
  sheetProject: "Proyecto",
  sheetCircuits: "Circuitos",
  sheetMemoria: "Memoria",
  sheetIssues: "Observaciones",
  sheetSchedule: "Cuadro {tag}",
} as const;

export type ReportStringKey = keyof typeof reportStrings;

export function rs(key: ReportStringKey, vars?: Record<string, string | number>): string {
  let s: string = reportStrings[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
