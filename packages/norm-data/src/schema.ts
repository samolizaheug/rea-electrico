import { z } from "zod";

/**
 * Formato de una tabla normativa.
 *
 * Cada archivo JSON contiene UNA tabla de una norma y edición, con:
 * - `reference`: tabla y artículo de origen, tal como se citan en la memoria de cálculo.
 * - `source`: documento fuente (con huella SHA-256), páginas y método de captura.
 * - `data`: valores de uso. Si hubo erratas aprobadas, aquí está el valor CORREGIDO
 *   y `errata[]` conserva el valor tal como se publicó.
 *
 * El estado de verificación NO vive aquí: está en `verificacion.json` de cada norma,
 * ligado a la huella de `data`. Así, regenerar una tabla no borra su verificación, pero
 * si los datos cambian, la verificación deja de valer automáticamente.
 */

const num = z.number().finite();
const cell = num.nullable(); // null = celda vacía o "-" en la tabla publicada

export const designationSchema = z.object({
  /** Designación del calibre como aparece en la tabla: "14", "1/0", "250". */
  designation: z.string().min(1),
  system: z.enum(["AWG", "kcmil", "mm2"]),
  /** Área en mm² tal como la indica la tabla (puede diferir entre tablas por redondeo). */
  areaMm2: num.positive().nullable(),
});

const ampacityData = z.object({
  basis: z.object({ ambientC: num, description: z.string() }),
  temperaturesC: z.array(num).min(1),
  rows: z.array(
    designationSchema.extend({
      cu: z.array(cell),
      al: z.array(cell),
      /** Marcado con ** en la tabla: limitación de protección por 240-4(d). */
      smallConductorLimit: z.boolean(),
    }),
  ),
});

const temperatureCorrectionData = z.object({
  baseAmbientC: num,
  temperaturesC: z.array(num).min(1),
  rows: z.array(
    z.object({
      /** null = "10 o menos". */
      ambientFromC: num.nullable(),
      ambientToC: num,
      factors: z.array(cell),
    }),
  ),
});

const adjustmentFactorsData = z.object({
  rows: z.array(z.object({ conductorsFrom: z.number().int(), conductorsTo: z.number().int().nullable(), percent: num })),
});

const standardRatingsData = z.object({
  /** Fusibles e interruptores automáticos de tiempo inverso. */
  inverseTimeA: z.array(num),
  /** Valores adicionales solo para fusibles. */
  additionalFuseA: z.array(num),
});

const egcData = z.object({
  rows: z.array(
    z.object({
      maxRatingA: num,
      cu: designationSchema,
      al: designationSchema.nullable(),
    }),
  ),
});

const motorFlcData = z.object({
  motorKind: z.enum(["cc", "1F", "2F", "3F"]),
  groups: z.array(z.object({ id: z.string(), label: z.string(), voltagesV: z.array(num) })),
  rows: z.array(
    z.object({
      hp: z.string(),
      kW: num,
      currentsA: z.record(z.array(cell)),
    }),
  ),
});

const motorProtectionData = z.object({
  devices: z.array(z.object({ id: z.string(), label: z.string() })),
  rows: z.array(z.object({ motorType: z.string(), label: z.string(), percents: z.array(num) })),
});

const dutyCycleData = z.object({
  ratings: z.array(z.object({ id: z.string(), label: z.string() })),
  rows: z.array(z.object({ dutyClass: z.string(), label: z.string(), percents: z.array(cell) })),
});

const conductorPropertiesData = z.object({
  temperatureC: num,
  rows: z.array(
    designationSchema.extend({
      areaCmil: num.nullable(),
      strands: z.number().int(),
      strandDiameterMm: num.nullable(),
      overallDiameterMm: num,
      overallAreaMm2: num,
      dcResistanceOhmPerKm: z.object({ cu: num, cuCoated: num, al: num.nullable() }),
    }),
  ),
});

const conduitTriple = z.object({ pvc: cell, aluminio: cell, acero: cell });
const acImpedanceData = z.object({
  temperatureC: num,
  frequencyHz: num,
  powerFactorForZ: num,
  rows: z.array(
    designationSchema.extend({
      /** La tabla publica una sola columna de XL para PVC o aluminio, y otra para acero. */
      xlOhmPerKm: z.object({ pvcOAluminio: num, acero: num }),
      rCuOhmPerKm: conduitTriple,
      rAlOhmPerKm: conduitTriple,
      zCuOhmPerKm: conduitTriple,
      zAlOhmPerKm: conduitTriple,
    }),
  ),
});

const insulationTypesData = z.object({
  rows: z.array(
    z.object({
      type: z.string(),
      genericName: z.string(),
      ratings: z.array(z.object({ temperatureC: num, locations: z.string() })),
      note: z.string().optional(),
    }),
  ),
});

/** Factores por escalones acumulativos: cada escalón aplica a la porción de carga hasta `upToVA`. */
const demandFactorsData = z.object({
  rows: z.array(
    z.object({
      occupancy: z.string(),
      label: z.string(),
      tiers: z.array(
        z.object({
          /** Límite superior acumulado de la porción, VA; null = "a partir de" (resto de la carga). */
          upToVA: num.nullable(),
          percent: num,
          /** Texto tal como aparece en la tabla. */
          publishedText: z.string(),
        }),
      ),
      note: z.string().optional(),
    }),
  ),
});

/** Capítulo 10, Tabla 4: dimensiones interiores de tubos por artículo y designación. */
const racewayDimensionsData = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      article: z.string(),
      /** Título tal como aparece en la tabla publicada. */
      publishedTitle: z.string(),
      label: z.string(),
      rows: z.array(
        z.object({
          metricDesignation: z.number().int(),
          tradeSize: z.string(),
          internalDiameterMm: num.nullable(),
          totalAreaMm2: num.nullable(),
          /** Área disponible: 60 % del total y llenado para 1, 2 y más de 2 conductores (53 %, 31 %, 40 %). */
          area60Mm2: num.nullable(),
          fill1Mm2: num.nullable(),
          fill2Mm2: num.nullable(),
          fillOver2Mm2: num.nullable(),
        }),
      ),
    }),
  ),
});

/** Tabla 392-22(a): área de ocupación de charolas por ancho interior. */
const trayFillData = z.object({
  rows: z.array(
    z.object({
      widthCm: num,
      /** Columna 1: escalera, malla o fondo ventilado, 392-22(a)(1)(b). */
      ladderMm2: num,
      /** Columna 3: fondo sólido, 392-22(a)(3)(b). */
      solidMm2: num,
      /** Columnas 2 y 4: el mismo valor menos k·Sd (Sd = suma de diámetros de cables de 4/0 y mayores). */
      ladderSdFactor: num,
      solidSdFactor: num,
    }),
  ),
});

// ---------------------------------------------------------------- IEC 60364 (secciones en mm²)

/**
 * Ampacidad por método de instalación de referencia (A1, A2, B1, B2, C, D, E, F, G).
 * Cada columna es una combinación de material, aislamiento, conductores cargados y disposición.
 */
const iecAmpacityData = z.object({
  /** Temperatura de referencia: aire 30 °C (métodos A–C, E–G) o terreno 20 °C (método D). */
  reference: z.object({ medium: z.enum(["aire", "terreno"]), temperatureC: num, note: z.string().optional() }),
  sizesMm2: z.array(num.positive()).min(1),
  columns: z.array(
    z.object({
      id: z.string(),
      method: z.string(),
      material: z.enum(["Cu", "Al"]),
      insulation: z.enum(["PVC", "XLPE"]),
      loadedConductors: z.union([z.literal(2), z.literal(3)]),
      /** Disposición cuando el método tiene variantes (F: trébol o plano; G: horizontal o vertical). */
      arrangement: z.string().optional(),
      /** Un valor por sección de `sizesMm2`; null = sin valor en la tabla. */
      values: z.array(cell),
    }),
  ),
});

/** Tabla genérica de factores: renglones (temperatura, disposición...) × columnas. */
const factorTableData = z.object({
  rowHeader: z.string(),
  columns: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
  rows: z.array(z.object({ key: z.string(), label: z.string(), values: z.array(cell) })),
});

/** Resistencia (a la temperatura indicada) y reactancia por unidad de longitud de cables. */
const cableImpedanceData = z.object({
  material: z.enum(["Cu", "Al"]),
  temperatureC: num,
  frequencyHz: num,
  rows: z.array(
    z.object({
      sizeMm2: num.positive(),
      singleCore: z.object({ rOhmPerKm: num, xOhmPerKm: num }),
      multiCore: z.object({ rOhmPerKm: num, xOhmPerKm: num }),
    }),
  ),
});

/** Sección mínima del conductor de protección en función de la sección de fase S. */
const peSizeData = z.object({
  rows: z.array(
    z.object({
      /** Intervalo de S: (desde, hasta]; null = sin límite. */
      phaseAboveMm2: num.nullable(),
      phaseUpToMm2: num.nullable(),
      /** Regla para el mismo material que la fase: "S", un valor fijo en mm² o "S/2". */
      sameMaterial: z.union([z.literal("S"), z.literal("S/2"), num]),
      publishedText: z.string(),
    }),
  ),
});

export const tableKinds = {
  "iec-ampacity": iecAmpacityData,
  "factor-table": factorTableData,
  "cable-impedance": cableImpedanceData,
  "pe-size": peSizeData,
  "raceway-dimensions": racewayDimensionsData,
  "tray-fill": trayFillData,
  ampacity: ampacityData,
  "temperature-correction": temperatureCorrectionData,
  "adjustment-factors": adjustmentFactorsData,
  "standard-ratings": standardRatingsData,
  "egc-size": egcData,
  "motor-flc": motorFlcData,
  "motor-protection": motorProtectionData,
  "duty-cycle": dutyCycleData,
  "conductor-properties": conductorPropertiesData,
  "ac-impedance": acImpedanceData,
  "insulation-types": insulationTypesData,
  "demand-factors": demandFactorsData,
} as const;

export type TableKind = keyof typeof tableKinds;

export const errataSchema = z.object({
  /** Ubicación en `data` (p. ej. "rows[13].ambientFromC"). */
  path: z.string(),
  asPublished: z.union([num, z.string()]),
  corrected: z.union([num, z.string()]),
  reason: z.string(),
  approvedBy: z.string(),
  approvedAt: z.string(),
});

const envelope = z.object({
  id: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  norm: z.object({ id: z.string(), edition: z.string() }),
  reference: z.object({ table: z.string(), article: z.string(), title: z.string() }),
  source: z.object({
    document: z.string(),
    sha256: z.string().regex(/^[0-9A-F]{64}$/),
    publication: z.string(),
    pages: z.array(z.number().int().positive()).min(1),
    method: z.enum(["extraccion-automatica", "transcripcion-manual", "captura-usuario"]),
    extractor: z.string().optional(),
  }),
  notes: z.array(z.string()),
  errata: z.array(errataSchema),
});

export const normTableSchema = z.discriminatedUnion(
  "kind",
  Object.entries(tableKinds).map(([kind, data]) => envelope.extend({ kind: z.literal(kind), data })) as unknown as [
    z.ZodDiscriminatedUnionOption<"kind">,
    ...z.ZodDiscriminatedUnionOption<"kind">[],
  ],
);

type Envelope = z.infer<typeof envelope>;
export type NormTable = {
  [K in TableKind]: Envelope & { kind: K; data: z.infer<(typeof tableKinds)[K]> };
}[TableKind];
export type NormTableOf<K extends TableKind> = Extract<NormTable, { kind: K }>;

export const verificationStatusSchema = z.enum(["por_verificar", "fuente_secundaria", "verificado"]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

/** `verificacion.json`: registro humano de revisión por tabla. */
export const verificationFileSchema = z.object({
  norm: z.object({ id: z.string(), edition: z.string() }),
  tables: z.record(
    z.object({
      status: verificationStatusSchema,
      /** Huella SHA-256 de `data` en el momento de la revisión. */
      fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      by: z.string(),
      date: z.string(),
      notes: z.string().optional(),
    }),
  ),
});
export type VerificationFile = z.infer<typeof verificationFileSchema>;
