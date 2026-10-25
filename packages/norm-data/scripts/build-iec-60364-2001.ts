/**
 * Construye las tablas de IEC 60364 (5-52:2001 y partes relacionadas) a partir de la fuente
 * secundaria ABB SACE, Electrical installation handbook Vol. 2, 4.ª ed. (2006).
 *
 * Método: transcripción manual desde las páginas del PDF renderizadas como imagen (pdftoppm,
 * 170 ppp). La capa de texto del PDF desalinea columnas en las tablas de ampacidad, por eso no
 * se usa extracción automática; la capa de texto sí se usa en las pruebas como comparación
 * independiente (multiconjunto de valores por página) y las tablas de caída específica
 * (Tablas 3–12) sirven para verificar R y X.
 *
 * Uso: pnpm norm:construir-iec-2001
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { normTableSchema, type NormTable } from "../src/schema";
import { writeCatalogAndReport } from "./catalog-writer";
import { DATA_DIR, SOURCES, assertSourceHash } from "./sources";

const SOURCE_ID = "abb-eih-vol2-4ed" as const;
const NORM = { id: "iec-60364", edition: "2001" };
const DS = "iec-60364-2001";
assertSourceHash(SOURCE_ID);

const SECONDARY = "Fuente secundaria: ABB SACE, Electrical installation handbook Vol. 2, 4.ª ed. (2006), que reproduce IEC 60364-5-52:2001. Pendiente de cotejo con la norma IEC.";

function envelope(id: string, table: string, article: string, title: string, pages: number[], notes: string[] = []) {
  return {
    id: `${DS}/${id}`,
    norm: NORM,
    reference: { table, article, title },
    source: {
      document: SOURCES[SOURCE_ID].file.split("/").pop()!,
      sha256: SOURCES[SOURCE_ID].sha256,
      publication: SOURCES[SOURCE_ID].publication,
      pages,
      method: "transcripcion-manual" as const,
      extractor: "Claude (asistente IA), desde la imagen de la página (pdftoppm 170 ppp)",
    },
    notes: [SECONDARY, ...notes],
    errata: [],
  };
}

// ---------------------------------------------------------------- Tabla 8 y Tabla 15: ampacidad

const SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const _ = null;

/** Renglones por sección: [sección, ...valores en el orden de `cols`]. Las secciones que faltan quedan en null. */
type Row = [number, ...(number | null)[]];
interface ColDef {
  id: string;
  method: string;
  material: "Cu" | "Al";
  insulation: "PVC" | "XLPE";
  loadedConductors: 2 | 3;
  arrangement?: string;
}

function columns(defs: ColDef[], rows: Row[]) {
  for (const r of rows) if (r.length !== defs.length + 1) throw new Error(`Renglón ${r[0]}: ${r.length - 1} valores, se esperaban ${defs.length}.`);
  return defs.map((d, i) => ({
    ...d,
    values: SIZES.map((s) => {
      const r = rows.find((x) => x[0] === s);
      return r ? (r[i + 1] as number | null) : null;
    }),
  }));
}

/** Orden de columnas de la Tabla 8 (A1, A2, B1, B2, C) y de la Tabla 15 (D). */
const stdCols = (method: string): ColDef[] =>
  (
    [
      ["Cu", "XLPE", 2],
      ["Cu", "XLPE", 3],
      ["Cu", "PVC", 2],
      ["Cu", "PVC", 3],
      ["Al", "XLPE", 2],
      ["Al", "XLPE", 3],
      ["Al", "PVC", 2],
      ["Al", "PVC", 3],
    ] as const
  ).map(([material, insulation, n]) => ({ id: `${method}-${material}-${insulation}-${n}`, method, material, insulation, loadedConductors: n }));

const A1: Row[] = [
  [1.5, 19, 17, 14.5, 13.5, _, _, _, _],
  [2.5, 26, 23, 19.5, 18, 20, 19, 15, 14],
  [4, 35, 31, 26, 24, 27, 25, 20, 18.5],
  [6, 45, 40, 34, 31, 35, 32, 26, 24],
  [10, 61, 54, 46, 42, 48, 44, 36, 32],
  [16, 81, 73, 61, 56, 64, 58, 48, 43],
  [25, 106, 95, 80, 73, 84, 76, 63, 57],
  [35, 131, 117, 99, 89, 103, 94, 77, 70],
  [50, 158, 141, 119, 108, 125, 113, 93, 84],
  [70, 200, 179, 151, 136, 158, 142, 118, 107],
  [95, 241, 216, 182, 164, 191, 171, 142, 129],
  [120, 278, 249, 210, 188, 220, 197, 164, 149],
  [150, 318, 285, 240, 216, 253, 226, 189, 170],
  [185, 362, 324, 273, 245, 288, 256, 215, 194],
  [240, 424, 380, 321, 286, 338, 300, 252, 227],
  [300, 486, 435, 367, 328, 387, 344, 289, 261],
];
const A2: Row[] = [
  [1.5, 18.5, 16.5, 14, 13, _, _, _, _],
  [2.5, 25, 22, 18.5, 17.5, 19.5, 18, 14.5, 13.5],
  [4, 33, 30, 25, 23, 26, 24, 19.5, 17.5],
  [6, 42, 38, 32, 29, 33, 31, 25, 23],
  [10, 57, 51, 43, 39, 45, 41, 33, 31],
  [16, 76, 68, 57, 52, 60, 55, 44, 41],
  [25, 99, 89, 75, 68, 78, 71, 58, 53],
  [35, 121, 109, 92, 83, 96, 87, 71, 65],
  [50, 145, 130, 110, 99, 115, 104, 86, 78],
  [70, 183, 164, 139, 125, 145, 131, 108, 98],
  [95, 220, 197, 167, 150, 175, 157, 130, 118],
  [120, 253, 227, 192, 172, 201, 180, 150, 135],
  [150, 290, 259, 219, 196, 230, 206, 172, 155],
  [185, 329, 295, 248, 223, 262, 233, 195, 176],
  [240, 386, 346, 291, 261, 307, 273, 229, 207],
  [300, 442, 396, 334, 298, 352, 313, 263, 237],
];
const B1: Row[] = [
  [1.5, 23, 20, 17.5, 15.5, _, _, _, _],
  [2.5, 31, 28, 24, 21, 25, 22, 18.5, 16.5],
  [4, 42, 37, 32, 28, 33, 29, 25, 22],
  [6, 54, 48, 41, 36, 43, 38, 32, 28],
  [10, 75, 66, 57, 50, 59, 52, 44, 39],
  [16, 100, 88, 76, 68, 79, 71, 60, 53],
  [25, 133, 117, 101, 89, 105, 93, 79, 70],
  [35, 164, 144, 125, 110, 130, 116, 97, 86],
  [50, 198, 175, 151, 134, 157, 140, 118, 104],
  [70, 253, 222, 192, 171, 200, 179, 150, 133],
  [95, 306, 269, 232, 207, 242, 217, 181, 161],
  [120, 354, 312, 269, 239, 281, 251, 210, 186],
];
const B2: Row[] = [
  [1.5, 22, 19.5, 16.5, 15, _, _, _, _],
  [2.5, 30, 26, 23, 20, 23, 21, 17.5, 15.5],
  [4, 40, 35, 30, 27, 31, 28, 24, 21],
  [6, 51, 44, 38, 34, 40, 35, 30, 27],
  [10, 69, 60, 52, 46, 54, 48, 41, 36],
  [16, 91, 80, 69, 62, 72, 64, 54, 48],
  [25, 119, 105, 90, 80, 94, 84, 71, 62],
  [35, 146, 128, 111, 99, 115, 103, 86, 77],
  [50, 175, 154, 133, 118, 138, 124, 104, 92],
  [70, 221, 194, 168, 149, 175, 156, 131, 116],
  [95, 265, 233, 201, 179, 210, 188, 157, 139],
  [120, 305, 268, 232, 206, 242, 216, 181, 160],
];
const C: Row[] = [
  [1.5, 24, 22, 19.5, 17.5, _, _, _, _],
  [2.5, 33, 30, 27, 24, 26, 24, 21, 18.5],
  [4, 45, 40, 36, 32, 35, 32, 28, 25],
  [6, 58, 52, 46, 41, 45, 41, 36, 32],
  [10, 80, 71, 63, 57, 62, 57, 49, 44],
  [16, 107, 96, 85, 76, 84, 76, 66, 59],
  [25, 138, 119, 112, 96, 101, 90, 83, 73],
  [35, 171, 147, 138, 119, 126, 112, 103, 90],
  [50, 209, 179, 168, 144, 154, 136, 125, 110],
  [70, 269, 229, 213, 184, 198, 174, 160, 140],
  [95, 328, 278, 258, 223, 241, 211, 195, 170],
  [120, 382, 322, 299, 259, 280, 245, 226, 197],
  [150, 441, 371, 344, 299, 324, 283, 261, 227],
  [185, 506, 424, 392, 341, 371, 323, 298, 259],
  [240, 599, 500, 461, 403, 439, 382, 352, 305],
  [300, 693, 576, 530, 464, 508, 440, 406, 351],
];

/** Método E: columnas en el orden de la página (2 cargados: Cu XLPE, Cu PVC, Al XLPE, Al PVC; luego 3 cargados). */
const eCols: ColDef[] = ([2, 3] as const).flatMap((n) =>
  (
    [
      ["Cu", "XLPE"],
      ["Cu", "PVC"],
      ["Al", "XLPE"],
      ["Al", "PVC"],
    ] as const
  ).map(([material, insulation]) => ({ id: `E-${material}-${insulation}-${n}`, method: "E", material, insulation, loadedConductors: n })),
);
const E: Row[] = [
  [1.5, 26, 22, _, _, 23, 18.5, _, _],
  [2.5, 36, 30, 28, 23, 32, 25, 24, 19.5],
  [4, 49, 40, 38, 31, 42, 34, 32, 26],
  [6, 63, 51, 49, 39, 54, 43, 42, 33],
  [10, 86, 70, 67, 54, 75, 60, 58, 46],
  [16, 115, 94, 91, 73, 100, 80, 77, 61],
  [25, 149, 119, 108, 89, 127, 101, 97, 78],
  [35, 185, 148, 135, 111, 158, 126, 120, 96],
  [50, 225, 180, 164, 135, 192, 153, 146, 117],
  [70, 289, 232, 211, 173, 246, 196, 187, 150],
  [95, 352, 282, 257, 210, 298, 238, 227, 183],
  [120, 410, 328, 300, 244, 346, 276, 263, 212],
  [150, 473, 379, 346, 282, 399, 319, 304, 245],
  [185, 542, 434, 397, 322, 456, 364, 347, 280],
  [240, 641, 514, 470, 380, 538, 430, 409, 330],
  [300, 741, 593, 543, 439, 621, 497, 471, 381],
];

/** Método F: dos unipolares en contacto; tres en trébol; tres en plano en contacto. Cu XLPE, Cu PVC, Al XLPE, Al PVC. */
const fCols: ColDef[] = (
  [
    [2, "contacto"],
    [3, "trebol"],
    [3, "plano"],
  ] as const
).flatMap(([n, arrangement]) =>
  (
    [
      ["Cu", "XLPE"],
      ["Cu", "PVC"],
      ["Al", "XLPE"],
      ["Al", "PVC"],
    ] as const
  ).map(([material, insulation]) => ({ id: `F-${arrangement}-${material}-${insulation}-${n}`, method: "F", material, insulation, loadedConductors: n, arrangement })),
);
const F: Row[] = [
  [25, 161, 131, 121, 98, 135, 110, 103, 84, 141, 114, 107, 87],
  [35, 200, 162, 150, 122, 169, 137, 129, 105, 176, 143, 135, 109],
  [50, 242, 196, 184, 149, 207, 167, 159, 128, 216, 174, 165, 133],
  [70, 310, 251, 237, 192, 268, 216, 206, 166, 279, 225, 215, 173],
  [95, 377, 304, 289, 235, 328, 264, 253, 203, 342, 275, 264, 212],
  [120, 437, 352, 337, 273, 383, 308, 296, 237, 400, 321, 308, 247],
  [150, 504, 406, 389, 316, 444, 356, 343, 274, 464, 372, 358, 287],
  [185, 575, 463, 447, 363, 510, 409, 395, 315, 533, 427, 413, 330],
  [240, 679, 546, 530, 430, 607, 485, 471, 375, 634, 507, 492, 392],
  [300, 783, 629, 613, 497, 703, 561, 547, 434, 736, 587, 571, 455],
  [400, 940, 754, 740, 600, 823, 656, 663, 526, 868, 689, 694, 552],
  [500, 1083, 868, 856, 694, 946, 749, 770, 610, 998, 789, 806, 640],
  [630, 1254, 1005, 996, 808, 1088, 855, 899, 711, 1151, 905, 942, 746],
];

/** Método G: unipolares separados, 3 cargados, horizontal (3H) y vertical (3V). Cu XLPE, Cu PVC, Al XLPE, Al PVC. */
const gCols: ColDef[] = (
  [
    ["Cu", "XLPE"],
    ["Cu", "PVC"],
    ["Al", "XLPE"],
    ["Al", "PVC"],
  ] as const
).flatMap(([material, insulation]) =>
  (["horizontal", "vertical"] as const).map((arrangement) => ({ id: `G-${arrangement}-${material}-${insulation}-3`, method: "G", material, insulation, loadedConductors: 3 as const, arrangement })),
);
const G: Row[] = [
  [25, 182, 161, 146, 130, 138, 122, 112, 99],
  [35, 226, 201, 181, 162, 172, 153, 139, 124],
  [50, 275, 246, 219, 197, 210, 188, 169, 152],
  [70, 353, 318, 281, 254, 271, 244, 217, 196],
  [95, 430, 389, 341, 311, 332, 300, 265, 241],
  [120, 500, 454, 396, 362, 387, 351, 308, 282],
  [150, 577, 527, 456, 419, 448, 408, 356, 327],
  [185, 661, 605, 521, 480, 515, 470, 407, 376],
  [240, 781, 719, 615, 569, 611, 561, 482, 447],
  [300, 902, 833, 709, 659, 708, 652, 557, 519],
  [400, 1085, 1008, 852, 795, 856, 792, 671, 629],
  [500, 1253, 1169, 982, 920, 991, 921, 775, 730],
  [630, 1454, 1362, 1138, 1070, 1154, 1077, 900, 852],
];

const D: Row[] = [
  [1.5, 26, 22, 22, 18, _, _, _, _],
  [2.5, 34, 29, 29, 24, 26, 22, 22, 18.5],
  [4, 44, 37, 38, 31, 34, 29, 29, 24],
  [6, 56, 46, 47, 39, 42, 36, 36, 30],
  [10, 73, 61, 63, 52, 56, 47, 48, 40],
  [16, 95, 79, 81, 67, 73, 61, 62, 52],
  [25, 121, 101, 104, 86, 93, 78, 80, 66],
  [35, 146, 122, 125, 103, 112, 94, 96, 80],
  [50, 173, 144, 148, 122, 132, 112, 113, 94],
  [70, 213, 178, 183, 151, 163, 138, 140, 117],
  [95, 252, 211, 216, 179, 193, 164, 166, 138],
  [120, 287, 240, 246, 203, 220, 186, 189, 157],
  [150, 324, 271, 278, 230, 249, 210, 213, 178],
  [185, 363, 304, 312, 258, 279, 236, 240, 200],
  [240, 419, 351, 361, 297, 322, 272, 277, 230],
  [300, 474, 396, 408, 336, 364, 308, 313, 260],
];

const tables: NormTable[] = [];

tables.push({
  ...envelope(
    "ampacidad-aire",
    "Tabla 8 (ABB)",
    "IEC 60364-5-52:2001, 523 y Anexo",
    "Ampacidad de cables con aislamiento de PVC o EPR/XLPE, métodos A1, A2, B1, B2, C, E, F y G (30 °C en aire)",
    [41, 42, 43, 44],
    [
      "Las celdas grises de la tabla publicada se registran como null: la fuente no da valores de B1 y B2 para secciones mayores de 120 mm², ni de A1/A2/E para más de 300 mm², ni de F y G para menos de 25 mm².",
      "Método F: dos unipolares en contacto, tres en trébol y tres en plano en contacto; método G: tres unipolares separados, en horizontal o en vertical (De entre cables).",
      "Cotejo con la 2.ª ed. del mismo manual (1SDC010001D0202): coinciden todas las celdas salvo dos, que se registran como publicadas en la 4.ª ed. y quedan pendientes de cotejo con la norma IEC:",
      "ABB-2: A1, Al PVC, 2 conductores cargados, 2.5 mm²: 4.ª ed. = 15 A; 2.ª ed. = 14.5 A.",
      "ABB-3: A2, Al PVC, 2 conductores cargados, 4 mm²: 4.ª ed. = 19.5 A; 2.ª ed. = 20 A.",
      "La capa de texto de la p. 43 lee «845» en F trébol, Al PVC, 25 mm²; la imagen muestra 84.",
    ],
  ),
  kind: "iec-ampacity",
  data: {
    reference: { medium: "aire", temperatureC: 30 },
    sizesMm2: SIZES,
    columns: [
      ...columns(stdCols("A1"), A1),
      ...columns(stdCols("A2"), A2),
      ...columns(stdCols("B1"), B1),
      ...columns(stdCols("B2"), B2),
      ...columns(stdCols("C"), C),
      ...columns(eCols, E),
      ...columns(fCols, F),
      ...columns(gCols, G),
    ],
  },
} as NormTable);

tables.push({
  ...envelope(
    "ampacidad-terreno",
    "Tabla 15 (ABB)",
    "IEC 60364-5-52:2001, 523 y Anexo",
    "Ampacidad de cables enterrados, método D (20 °C del terreno, resistividad térmica 2.5 K·m/W)",
    [51],
    ["La figura del método D muestra el cable dentro de un ducto enterrado (Tabla 3, ítems 70 y 71). Profundidad de referencia 0.7 m (notas de las Tablas 11–13)."],
  ),
  kind: "iec-ampacity",
  data: {
    reference: { medium: "terreno", temperatureC: 20, note: "Resistividad térmica del suelo de referencia 2.5 K·m/W." },
    sizesMm2: SIZES,
    columns: columns(stdCols("D"), D),
  },
} as NormTable);

// ---------------------------------------------------------------- Factores

const factorRows = (rows: [string, ...(number | null)[]][], label: (k: string) => string) => rows.map(([key, ...values]) => ({ key, label: label(key), values }));

tables.push({
  ...envelope("tabla-4-temperatura-aire", "Tabla 4 (ABB)", "IEC 60364-5-52:2001, 523", "Factor de corrección k1 para temperatura ambiente del aire distinta de 30 °C", [34], [
    "Para temperaturas ambiente mayores a las de la tabla, la fuente remite al fabricante (nota a).",
    "Anomalía en la fuente (ABB-1): columna mineral 70 °C, renglón 45 °C = 0.87, mayor que el de 40 °C (0.85); rompe la secuencia. Se transcribe tal cual; la herramienta no ofrece cables con aislamiento mineral.",
  ]),
  kind: "factor-table",
  data: {
    rowHeader: "Temperatura ambiente °C",
    columns: [
      { id: "PVC", label: "PVC" },
      { id: "XLPE", label: "XLPE y EPR" },
      { id: "mineral-70", label: "Mineral, cubierta de PVC o desnudo expuesto al contacto, 70 °C" },
      { id: "mineral-105", label: "Mineral, desnudo no expuesto al contacto, 105 °C" },
    ],
    rows: factorRows(
      [
        ["10", 1.22, 1.15, 1.26, 1.14],
        ["15", 1.17, 1.12, 1.2, 1.11],
        ["20", 1.12, 1.08, 1.14, 1.07],
        ["25", 1.06, 1.04, 1.07, 1.04],
        ["35", 0.94, 0.96, 0.93, 0.96],
        ["40", 0.87, 0.91, 0.85, 0.92],
        ["45", 0.79, 0.87, 0.87, 0.88],
        ["50", 0.71, 0.82, 0.67, 0.84],
        ["55", 0.61, 0.76, 0.57, 0.8],
        ["60", 0.5, 0.71, 0.45, 0.75],
        ["65", _, 0.65, _, 0.7],
        ["70", _, 0.58, _, 0.65],
        ["75", _, 0.5, _, 0.6],
        ["80", _, 0.41, _, 0.54],
        ["85", _, _, _, 0.47],
        ["90", _, _, _, 0.4],
        ["95", _, _, _, 0.32],
      ],
      (k) => `${k} °C`,
    ),
  },
} as NormTable);

tables.push({
  ...envelope("tabla-10-temperatura-terreno", "Tabla 10 (ABB)", "IEC 60364-5-52:2001, 523", "Factor de corrección k1 para temperatura del terreno distinta de 20 °C", [47]),
  kind: "factor-table",
  data: {
    rowHeader: "Temperatura del terreno °C",
    columns: [
      { id: "PVC", label: "PVC" },
      { id: "XLPE", label: "XLPE y EPR" },
    ],
    rows: factorRows(
      [
        ["10", 1.1, 1.07],
        ["15", 1.05, 1.04],
        ["25", 0.95, 0.96],
        ["30", 0.89, 0.93],
        ["35", 0.84, 0.89],
        ["40", 0.77, 0.85],
        ["45", 0.71, 0.8],
        ["50", 0.63, 0.76],
        ["55", 0.55, 0.71],
        ["60", 0.45, 0.65],
        ["65", _, 0.6],
        ["70", _, 0.53],
        ["75", _, 0.46],
        ["80", _, 0.38],
      ],
      (k) => `${k} °C`,
    ),
  },
} as NormTable);

const COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "12", "16", "20"];
tables.push({
  ...envelope("tabla-5-agrupamiento", "Tabla 5 (ABB)", "IEC 60364-5-52:2001, 523", "Factor de reducción k2 para cables agrupados (en contacto), por número de circuitos o cables multiconductores", [37], [
    "Disposiciones 2 a 5: la fuente indica que no hay reducción adicional para más de nueve circuitos o cables multiconductores (se registran null en 12, 16 y 20).",
    "Nota 2 de la tabla: si la separación horizontal entre cables adyacentes excede dos veces su diámetro exterior, no se aplica factor.",
    "Nota 5 de la tabla: n cables unipolares se pueden considerar n/2 circuitos de dos conductores cargados o n/3 circuitos de tres conductores cargados.",
    "Métodos de referencia: disposición 1 → métodos A a F; 2 y 3 → método C; 4 y 5 → métodos E y F.",
  ]),
  kind: "factor-table",
  data: {
    rowHeader: "Disposición (cables en contacto)",
    columns: COUNTS.map((c) => ({ id: c, label: `${c} circuito(s)` })),
    rows: [
      { key: "1", label: "Agrupados en aire, sobre superficie, embebidos o en canalización cerrada", values: [1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5, 0.45, 0.41, 0.38] },
      { key: "2", label: "Una capa sobre pared, piso o charola sin perforar", values: [1, 0.85, 0.79, 0.75, 0.73, 0.72, 0.72, 0.71, 0.7, _, _, _] },
      { key: "3", label: "Una capa fija directamente bajo techo de madera", values: [0.95, 0.81, 0.72, 0.68, 0.66, 0.64, 0.63, 0.62, 0.61, _, _, _] },
      { key: "4", label: "Una capa en charola perforada horizontal o vertical", values: [1, 0.88, 0.82, 0.77, 0.75, 0.73, 0.73, 0.72, 0.72, _, _, _] },
      { key: "5", label: "Una capa en escalera, ménsulas, etc.", values: [1, 0.87, 0.82, 0.8, 0.8, 0.79, 0.79, 0.78, 0.78, _, _, _] },
    ],
  },
} as NormTable);

tables.push({
  ...envelope("tabla-14-resistividad-suelo", "Tabla 14 (ABB)", "IEC 60364-5-52:2001, 523", "Factor de corrección k3 para resistividad térmica del suelo distinta de 2.5 K·m/W", [50], [
    "Aplica a cables en ductos enterrados a profundidad de hasta 0.8 m; precisión ±5 % (notas 1–3 de la tabla).",
  ]),
  kind: "factor-table",
  data: {
    rowHeader: "Resistividad térmica K·m/W",
    columns: [{ id: "k3", label: "Factor de corrección" }],
    rows: factorRows(
      [
        ["1", 1.18],
        ["1.5", 1.1],
        ["2", 1.05],
        ["2.5", 1],
        ["3", 0.96],
      ],
      (k) => `${k} K·m/W`,
    ),
  },
} as NormTable);

// ---------------------------------------------------------------- Impedancias (caída de tensión)

const impRows = (rows: [number, number, number, number, number][]) =>
  rows.map(([sizeMm2, rs, xs, rm, xm]) => ({ sizeMm2, singleCore: { rOhmPerKm: rs, xOhmPerKm: xs }, multiCore: { rOhmPerKm: rm, xOhmPerKm: xm } }));
const IMP_NOTE = "R a 80 °C; X a 50 Hz. La fuente indica que a 60 Hz la reactancia se multiplica por 1.2 (p. 60 del PDF, «Voltage drop calculation»).";

tables.push({
  ...envelope("tabla-1-impedancia-cu", "Tabla 1 (ABB, cap. 2.2.2)", "IEC 60364-5-52:2001, 525", "Resistencia y reactancia por unidad de longitud de cables de cobre", [61], [IMP_NOTE]),
  kind: "cable-impedance",
  data: {
    material: "Cu",
    temperatureC: 80,
    frequencyHz: 50,
    rows: impRows([
      [1.5, 14.8, 0.168, 15.1, 0.118],
      [2.5, 8.91, 0.156, 9.08, 0.109],
      [4, 5.57, 0.143, 5.68, 0.101],
      [6, 3.71, 0.135, 3.78, 0.0955],
      [10, 2.24, 0.119, 2.27, 0.0861],
      [16, 1.41, 0.112, 1.43, 0.0817],
      [25, 0.889, 0.106, 0.907, 0.0813],
      [35, 0.641, 0.101, 0.654, 0.0783],
      [50, 0.473, 0.101, 0.483, 0.0779],
      [70, 0.328, 0.0965, 0.334, 0.0751],
      [95, 0.236, 0.0975, 0.241, 0.0762],
      [120, 0.188, 0.0939, 0.191, 0.074],
      [150, 0.153, 0.0928, 0.157, 0.0745],
      [185, 0.123, 0.0908, 0.125, 0.0742],
      [240, 0.0943, 0.0902, 0.0966, 0.0752],
      [300, 0.0761, 0.0895, 0.078, 0.075],
    ]),
  },
} as NormTable);

tables.push({
  ...envelope("tabla-2-impedancia-al", "Tabla 2 (ABB, cap. 2.2.2)", "IEC 60364-5-52:2001, 525", "Resistencia y reactancia por unidad de longitud de cables de aluminio", [61], [
    IMP_NOTE,
    "El renglón de 120 mm² publica la resistencia de cable unipolar como «0,310» (coma decimal); se registra 0.310.",
  ]),
  kind: "cable-impedance",
  data: {
    material: "Al",
    temperatureC: 80,
    frequencyHz: 50,
    rows: impRows([
      [1.5, 24.384, 0.168, 24.878, 0.118],
      [2.5, 14.68, 0.156, 14.96, 0.109],
      [4, 9.177, 0.143, 9.358, 0.101],
      [6, 6.112, 0.135, 6.228, 0.0955],
      [10, 3.691, 0.119, 3.74, 0.0861],
      [16, 2.323, 0.112, 2.356, 0.0817],
      [25, 1.465, 0.106, 1.494, 0.0813],
      [35, 1.056, 0.101, 1.077, 0.0783],
      [50, 0.779, 0.101, 0.796, 0.0779],
      [70, 0.54, 0.0965, 0.55, 0.0751],
      [95, 0.389, 0.0975, 0.397, 0.0762],
      [120, 0.31, 0.0939, 0.315, 0.074],
      [150, 0.252, 0.0928, 0.259, 0.0745],
      [185, 0.203, 0.0908, 0.206, 0.0742],
      [240, 0.155, 0.0902, 0.159, 0.0752],
      [300, 0.125, 0.0895, 0.129, 0.075],
    ]),
  },
} as NormTable);

// ---------------------------------------------------------------- Conductor de protección y capacidades

tables.push({
  ...envelope("tabla-2-conductor-proteccion", "Tabla 2 (ABB, cap. 2.5)", "IEC 60364-5-54:2002, 543.1", "Sección mínima del conductor de protección", [86], [
    "Se registra la columna «mismo material que el conductor de línea». Para otro material la sección se multiplica por k1/k2 (valores de k de la Tabla 1 del cap. 2.4), que la herramienta aún no aplica.",
    "Para conductor PEN, la reducción solo se permite según las reglas del neutro (nota * de la tabla).",
  ]),
  kind: "pe-size",
  data: {
    rows: [
      { phaseAboveMm2: null, phaseUpToMm2: 16, sameMaterial: "S", publishedText: "S ≤ 16 → S" },
      { phaseAboveMm2: 16, phaseUpToMm2: 35, sameMaterial: 16, publishedText: "16 < S ≤ 35 → 16" },
      { phaseAboveMm2: 35, phaseUpToMm2: null, sameMaterial: "S/2", publishedText: "S > 35 → S/2" },
    ],
  },
} as NormTable);

tables.push({
  ...envelope("capacidades-interruptores", "Series de In de producto (ABB, cap. 5.8)", "IEC 60364-4-43:2001, 433.1 (Ib ≤ In ≤ Iz)", "Capacidades nominales de interruptores: MCB curva C y MCCB Tmax", [194, 197, 198, 199], [
    "IEC 60364 no fija capacidades normalizadas: In es un dato del producto. Se toman las series de ABB que aparecen en las tablas de longitud máxima protegida: MCB curva C (Tabla 2.3: 4 a 125 A), Tmax T3 TMD (Tabla 2.8: 160–250 A), T5-T6 TMA (Tabla 2.10: 320–800 A) y T7 (Tabla 2.12: 1000–1600 A).",
    "En interruptores de disparo ajustable, In es la corriente de ajuste (IEC 60364-4-43, citada en la p. 70 del PDF).",
  ]),
  kind: "standard-ratings",
  data: {
    inverseTimeA: [4, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600],
    additionalFuseA: [],
  },
} as NormTable);

// ---------------------------------------------------------------- Escritura

mkdirSync(`${DATA_DIR}${DS}`, { recursive: true });
for (const t of tables) {
  normTableSchema.parse(t);
  const file = `${DATA_DIR}${DS}/${t.id.split("/")[1]}.json`;
  writeFileSync(file, `${JSON.stringify(t, null, 2)}\n`, "utf8");
  console.log(`✓ ${t.reference.table.padEnd(34)} p. ${t.source.pages.join(", ")}`);
}
writeCatalogAndReport();
