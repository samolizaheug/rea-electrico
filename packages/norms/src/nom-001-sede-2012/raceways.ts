/**
 * Catálogo de métodos de instalación / canalizaciones para la NOM-001-SEDE-2012.
 *
 * Cada método indica:
 * - qué tabla de ampacidad aplica (o la regla especial, p. ej. charolas 392-80);
 * - qué columna de la Tabla 9 (R y XL) se usará para la caída de tensión;
 * - de dónde salen sus medidas comerciales.
 *
 * Cuando la norma no cubre un caso de forma directa se declara un SUPUESTO explícito
 * (`impedanceAssumption`), que aparece en la memoria de cálculo y queda pendiente de
 * confirmación del usuario.
 */

export type ImpedanceColumn = "pvc" | "aluminio" | "acero";

export type SizeSource =
  | { kind: "tabla-4"; section: string }
  | { kind: "charola" }
  | { kind: "ducto-catalogo" }
  | { kind: "ninguna" };

export interface RacewayMethod {
  value: string;
  label: string;
  group: string;
  /** Artículo de la NOM que regula el método. */
  article: string;
  /** Tabla de ampacidad, o null si aplica una regla especial (ver `ampacityRule`). */
  ampacityTable: "tabla-310-15-b-16" | "tabla-310-15-b-17" | null;
  ampacityRule?: string;
  /** Regla de factores de ajuste por agrupamiento cuando difiere de 310-15(b)(3)(a). */
  groupingRule?: string;
  impedanceColumn: ImpedanceColumn;
  impedanceAssumption?: string;
  sizes: SizeSource;
}

const T16 = "tabla-310-15-b-16" as const;
const T17 = "tabla-310-15-b-17" as const;

export const RACEWAY_METHODS: RacewayMethod[] = [
  // ---- Tubo conduit no metálico
  { value: "conduit-pvc-40", label: "Tubo conduit rígido de PVC cédula 40", group: "Tubo conduit no metálico", article: "352", ampacityTable: T16, impedanceColumn: "pvc", sizes: { kind: "tabla-4", section: "pvc-40-hdpe" } },
  { value: "conduit-pvc-80", label: "Tubo conduit rígido de PVC cédula 80", group: "Tubo conduit no metálico", article: "352", ampacityTable: T16, impedanceColumn: "pvc", sizes: { kind: "tabla-4", section: "pvc-80" } },
  { value: "conduit-pvc-a", label: "Tubo conduit rígido de PVC tipo A", group: "Tubo conduit no metálico", article: "352", ampacityTable: T16, impedanceColumn: "pvc", sizes: { kind: "tabla-4", section: "pvc-a" } },
  { value: "conduit-hdpe", label: "Conduit de polietileno de alta densidad (HDPE)", group: "Tubo conduit no metálico", article: "353", ampacityTable: T16, impedanceColumn: "pvc", sizes: { kind: "tabla-4", section: "pvc-40-hdpe" } },
  { value: "conduit-ent", label: "Tubo conduit no metálico (ENT)", group: "Tubo conduit no metálico", article: "362", ampacityTable: T16, impedanceColumn: "pvc", sizes: { kind: "tabla-4", section: "ent" } },

  // ---- Tubo conduit de acero galvanizado
  { value: "conduit-rmc-acero", label: "Tubo conduit metálico pesado de acero galvanizado (RMC)", group: "Tubo conduit de acero galvanizado", article: "344", ampacityTable: T16, impedanceColumn: "acero", sizes: { kind: "tabla-4", section: "rmc" } },
  { value: "conduit-imc-acero", label: "Tubo conduit metálico semipesado de acero galvanizado (IMC)", group: "Tubo conduit de acero galvanizado", article: "342", ampacityTable: T16, impedanceColumn: "acero", sizes: { kind: "tabla-4", section: "imc" } },
  { value: "conduit-emt-acero", label: "Tubo conduit metálico ligero de acero galvanizado (EMT)", group: "Tubo conduit de acero galvanizado", article: "358", ampacityTable: T16, impedanceColumn: "acero", sizes: { kind: "tabla-4", section: "emt" } },

  // ---- Tubo conduit de aluminio
  { value: "conduit-rmc-aluminio", label: "Tubo conduit metálico pesado de aluminio (RMC)", group: "Tubo conduit de aluminio", article: "344", ampacityTable: T16, impedanceColumn: "aluminio", sizes: { kind: "tabla-4", section: "rmc" } },
  { value: "conduit-emt-aluminio", label: "Tubo conduit metálico ligero de aluminio (EMT)", group: "Tubo conduit de aluminio", article: "358", ampacityTable: T16, impedanceColumn: "aluminio", sizes: { kind: "tabla-4", section: "emt" } },

  // ---- Acero inoxidable
  {
    value: "conduit-rmc-inox",
    label: "Tubo conduit metálico pesado de acero inoxidable (RMC)",
    group: "Tubo conduit de acero inoxidable",
    article: "344",
    ampacityTable: T16,
    impedanceColumn: "acero",
    impedanceAssumption:
      "La Tabla 9 no tiene columna para acero inoxidable; se usan R y XL de la columna de acero (valores más altos, caída de tensión conservadora). Supuesto aprobado por el usuario (Ing. RGLR, 2026-10-24).",
    sizes: { kind: "tabla-4", section: "rmc" },
  },

  // ---- Flexibles
  { value: "conduit-fmc", label: "Tubo conduit metálico flexible (FMC)", group: "Tubo conduit flexible", article: "348", ampacityTable: T16, impedanceColumn: "acero", sizes: { kind: "tabla-4", section: "fmc" } },
  { value: "conduit-lfmc", label: "Tubo conduit metálico flexible hermético a los líquidos (LFMC)", group: "Tubo conduit flexible", article: "350", ampacityTable: T16, impedanceColumn: "acero", sizes: { kind: "tabla-4", section: "lfmc" } },
  { value: "conduit-lfnc", label: "Tubo conduit no metálico flexible hermético a los líquidos (LFNC-B)", group: "Tubo conduit flexible", article: "356", ampacityTable: T16, impedanceColumn: "pvc", sizes: { kind: "tabla-4", section: "lfnc-b" } },

  // ---- Ductos
  {
    value: "ducto-metalico",
    label: "Ducto metálico con tapa (ducto cuadrado embisagrado)",
    group: "Ductos",
    article: "376",
    ampacityTable: T16,
    groupingRule: "376-22(b): los factores de ajuste de 310-15(b)(3)(a) se aplican solo si hay más de 30 conductores portadores de corriente. Llenado máximo 20 % (376-22(a)).",
    impedanceColumn: "acero",
    impedanceAssumption: "La Tabla 9 es para tres conductores en tubo conduit; para ducto metálico se usa la columna de acero como aproximación conservadora. Supuesto aprobado por el usuario (Ing. RGLR, 2026-10-24).",
    sizes: { kind: "ducto-catalogo" },
  },

  // ---- Charolas
  {
    value: "charola-escalera",
    label: "Charola portacables tipo escalera, malla o fondo ventilado",
    group: "Charolas portacables",
    article: "392",
    ampacityTable: null,
    ampacityRule: "392-80(a): ampacidad según el tipo de cable (multiconductor o conductores individuales) y su disposición en la charola. Se implementa en la etapa E6.",
    impedanceColumn: "pvc",
    impedanceAssumption: "La Tabla 9 es para tubo conduit; para charola (sin envolvente magnética) se usa la columna de PVC como aproximación. Supuesto aprobado por el usuario (Ing. RGLR, 2026-10-24).",
    sizes: { kind: "charola" },
  },
  {
    value: "charola-fondo-solido",
    label: "Charola portacables de fondo sólido",
    group: "Charolas portacables",
    article: "392",
    ampacityTable: null,
    ampacityRule: "392-80(a): ampacidad según el tipo de cable y su disposición en la charola; fondo sólido con tapa tiene factores propios. Se implementa en la etapa E6.",
    impedanceColumn: "pvc",
    impedanceAssumption: "La Tabla 9 es para tubo conduit; para charola se usa la columna de PVC como aproximación. Supuesto aprobado por el usuario (Ing. RGLR, 2026-10-24).",
    sizes: { kind: "charola" },
  },

  // ---- Instalaciones enterradas
  {
    value: "enterrado-directo",
    label: "Cables directamente enterrados",
    group: "Instalaciones enterradas",
    article: "300-5",
    ampacityTable: T16,
    impedanceColumn: "pvc",
    impedanceAssumption: "La Tabla 9 es para tubo conduit; para cable directamente enterrado se usa la columna de PVC (sin envolvente magnética) como aproximación. Supuesto aprobado por el usuario (Ing. RGLR, 2026-10-24).",
    sizes: { kind: "ninguna" },
  },
  {
    value: "enterrado-banco-pvc",
    label: "Banco de ductos enterrado (PVC cédula 40 / HDPE)",
    group: "Instalaciones enterradas",
    article: "352/353, 300-5",
    ampacityTable: T16,
    impedanceColumn: "pvc",
    sizes: { kind: "tabla-4", section: "pvc-40-hdpe" },
  },
  {
    value: "enterrado-banco-pvc-eb",
    label: "Banco de ductos de PVC tipo EB embebido en concreto",
    group: "Instalaciones enterradas",
    article: "352, 300-5",
    ampacityTable: T16,
    impedanceColumn: "pvc",
    sizes: { kind: "tabla-4", section: "pvc-eb" },
  },

  // ---- Aire libre
  {
    value: "aire-libre",
    label: "Conductores individuales al aire libre",
    group: "Al aire libre",
    article: "310-15(b)",
    ampacityTable: T17,
    impedanceColumn: "pvc",
    impedanceAssumption: "La Tabla 9 es para tubo conduit; al aire libre se usa la columna de PVC como aproximación (la reactancia real depende de la separación entre conductores). Supuesto aprobado por el usuario (Ing. RGLR, 2026-10-24).",
    sizes: { kind: "ninguna" },
  },
];

/**
 * Medidas comerciales de ducto cuadrado embisagrado. NO son datos de la norma: provienen de
 * catálogos de fabricante (fuente secundaria) y deben confirmarse con el proveedor del proyecto.
 */
export const DUCT_SIZES = [
  { value: "65x65", label: "65 × 65 mm (2½\")" },
  { value: "100x100", label: "100 × 100 mm (4\")" },
  { value: "150x150", label: "150 × 150 mm (6\")" },
];
export const DUCT_SIZES_SOURCE =
  "Catálogo Square D clase 5110 (63.5, 101.6 y 152.4 mm por lado) y Charofil (65 × 65 y 100 × 100 mm, certificación ANCE). Fuente secundaria: confirmar con el fabricante del proyecto.";

export function racewayMethod(value: unknown): RacewayMethod | undefined {
  return RACEWAY_METHODS.find((m) => m.value === value);
}
