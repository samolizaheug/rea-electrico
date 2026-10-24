/**
 * Construye las tablas JSON de la NOM-001-SEDE-2012 a partir del texto extraído del PDF del DOF.
 * Uso:
 *   pnpm --filter @rea/norm-data extract:nom-2012   (una vez: PDF → texto)
 *   pnpm --filter @rea/norm-data build:nom-2012     (texto → data/nom-001-sede-2012/*.json)
 *
 * Cada constructor ubica la tabla por su encabezado, interpreta sólo los renglones con la forma
 * esperada y verifica el número de renglones. Si el texto no coincide, falla en lugar de adivinar.
 * Las erratas aprobadas por el usuario se aplican aquí y quedan registradas en `errata[]`.
 * Las tablas con disposición compleja (310-104(a), 220-42, 220-44) se transcriben a mano en
 * archivos aparte (`source.method = "transcripcion-manual"`) y este script no las toca.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { normTableSchema, type NormTable } from "../src/schema";
import { writeCatalogAndReport } from "./catalog-writer";
import { DATA_DIR, SOURCES, assertSourceHash, textPath } from "./sources";
import { TextSource, cellValue, cells, expectCount, pagesOf, type SourceLine } from "./text-source";

const SOURCE_ID = "nom-001-sede-2012" as const;
const NORM = { id: "nom-001-sede", edition: "2012" };
const OUT_DIR = `${DATA_DIR}${SOURCE_ID}/`;
const APPROVAL = { approvedBy: "Usuario (ingeniero responsable)", approvedAt: "2026-10-24" };

assertSourceHash(SOURCE_ID);
const src = new TextSource(textPath(SOURCE_ID));

function source(lines: SourceLine[]) {
  return {
    document: SOURCES[SOURCE_ID].file,
    sha256: SOURCES[SOURCE_ID].sha256,
    publication: SOURCES[SOURCE_ID].publication,
    pages: pagesOf(lines),
    method: "extraccion-automatica" as const,
    extractor: "packages/norm-data/scripts/build-nom-001-sede-2012.ts",
  };
}

const AWG = ["18", "16", "14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0"];
function sizeSystem(designation: string): "AWG" | "kcmil" {
  if (AWG.includes(designation)) return "AWG";
  if (/^\d+$/.test(designation) && Number(designation) >= 250) return "kcmil";
  throw new Error(`Designación de calibre no reconocida: "${designation}"`);
}
const isDesignation = (t: string) => /^(\d+\/0|\d+)$/.test(t.replace(/\*+$/, ""));
const isNumber = (t: string) => /^-?\d+(\.\d+)?$/.test(t);
const isCell = (t: string) => isNumber(t.replace(/\*+$/, "")) || /^[-–—]+$/.test(t);

// ---------------------------------------------------------------- Ampacidades

function ampacity(heading: RegExp, file: string, table: string, title: string, inlineMarks: boolean): NormTable {
  const lines = src.section(heading, /^\* Véase 310-15\(b\)\(2\)/);
  const rows = [];
  let pendingMark = false;
  for (const l of lines) {
    if (l.text.trim() === "**") {
      pendingMark = true;
      continue;
    }
    const t = cells(l.text);
    if (t.length !== 8 || !isNumber(t[0]!) || !isDesignation(t[1]!) || !t.slice(2).every(isCell)) continue;
    const designation = t[1]!.replace(/\*+$/, "");
    const v = t.slice(2).map(cellValue);
    rows.push({
      designation,
      system: sizeSystem(designation),
      areaMm2: Number(t[0]),
      cu: v.slice(0, 3),
      al: v.slice(3, 6),
      smallConductorLimit: inlineMarks ? t[1]!.endsWith("**") : pendingMark,
    });
    pendingMark = false;
  }
  expectCount(rows, 30, table);
  return {
    id: `${SOURCE_ID}/${file}`,
    norm: NORM,
    kind: "ampacity",
    reference: { table, article: "310-15(b)", title },
    source: source(lines),
    data: {
      basis: { ambientC: 30, description: title },
      temperaturesC: [60, 75, 90],
      rows,
    },
    notes: [
      "* Véase 310-15(b)(2) para los factores de corrección de la ampacidad cuando la temperatura ambiente es diferente a 30 °C.",
      "** Véase 240-4(d) para limitaciones de protección contra sobrecorriente del conductor.",
      "Columnas 60/75/90 °C según la Tabla 310-104(a). Cobre: TW, UF (60 °C); RHW, THHW, THHW-LS, THW, THW-LS, THWN, XHHW, USE, ZW (75 °C); TBS, SA, SIS, FEP, FEPB, MI, RHH, RHW-2, THHN, THHW, THHW-LS, THW-2, THWN-2, USE-2, XHH, XHHW, XHHW-2, ZW-2 (90 °C).",
    ],
    errata: [],
  };
}

// ---------------------------------------------------------------- Corrección por temperatura

function temperatureCorrection(
  heading: RegExp,
  end: RegExp,
  file: string,
  table: string,
  baseAmbientC: number,
  temperaturesC: number[],
  expected: number,
): NormTable {
  const lines = src.section(heading, end);
  const rows = [];
  const errata = [];
  for (const l of lines) {
    const m = /^(10 o menos|\d+-\d+) \| (.+)$/.exec(l.text);
    if (!m) continue;
    const vals = cells(m[2]!);
    if (vals.length !== temperaturesC.length || !vals.every(isCell)) continue;
    let from: number | null = null;
    let to: number;
    if (m[1] === "10 o menos") to = 10;
    else {
      [from, to] = m[1]!.split("-").map(Number) as [number, number];
      if (from > to) {
        // Errata aprobada: "91-75" rompe la secuencia 66-70 → 76-80; debe ser 71-75.
        const corrected = to - 4;
        errata.push({
          path: `rows[${rows.length}].ambientFromC`,
          asPublished: m[1]!,
          corrected: `${corrected}-${to}`,
          reason: `El intervalo publicado "${m[1]}" rompe la secuencia (…-${to - 5} → ${to + 1}-…); se corrige a ${corrected}-${to}.`,
          ...APPROVAL,
        });
        from = corrected;
      }
    }
    rows.push({ ambientFromC: from, ambientToC: to, factors: vals.map(cellValue) });
  }
  expectCount(rows, expected, table);
  return {
    id: `${SOURCE_ID}/${file}`,
    norm: NORM,
    kind: "temperature-correction",
    reference: {
      table,
      article: "310-15(b)(2)",
      title: `Factores de corrección basados en una temperatura ambiente de ${baseAmbientC} °C`,
    },
    source: source(lines),
    data: { baseAmbientC, temperaturesC, rows },
    notes: [
      `Para temperaturas ambiente distintas de ${baseAmbientC} °C, multiplique las ampacidades permisibles por el factor correspondiente.`,
      "310-15(b)(2) permite también calcular el factor con la ecuación de esa sección.",
    ],
    errata,
  };
}

// ---------------------------------------------------------------- Agrupamiento

function adjustmentFactors(): NormTable {
  const lines = src.section(/^Tabla 310-15\(b\)\(3\)\(a\)\.-/, /^¹Es el número total/);
  const rows = [];
  for (const l of lines) {
    const m = /^(\d+)(?:-(\d+)| y más) \| (\d+)$/.exec(l.text);
    if (!m) continue;
    rows.push({ conductorsFrom: Number(m[1]), conductorsTo: m[2] ? Number(m[2]) : null, percent: Number(m[3]) });
  }
  expectCount(rows, 6, "Tabla 310-15(b)(3)(a)");
  return {
    id: `${SOURCE_ID}/tabla-310-15-b-3-a`,
    norm: NORM,
    kind: "adjustment-factors",
    reference: {
      table: "Tabla 310-15(b)(3)(a)",
      article: "310-15(b)(3)(a)",
      title: "Factores de ajuste para más de tres conductores portadores de corriente en una canalización o cable",
    },
    source: source(lines),
    data: { rows },
    notes: [
      "Porcentaje de los valores de las Tablas 310-15(b)(16) a 310-15(b)(19), ajustadas por temperatura ambiente si es necesario.",
      "¹ Número total de conductores en la canalización o cable ajustado de acuerdo con 310-15(b)(5) y (6).",
      "No se aplica a canalizaciones de 60 cm o menos de longitud (310-15(b)(3)(a)(2)).",
    ],
    errata: [],
  };
}

// ---------------------------------------------------------------- 240-6(a)

function standardRatings(): NormTable {
  const lines = src.section(/^240-6\. Capacidades estandarizadas/, /^b\) Interruptores automáticos de disparo ajustable/);
  const text = lines.map((l) => l.text).join(" ");
  const main = /son: ([\d, y]+) amperes/.exec(text);
  const extra = /fusibles deben ser de ([\d, y]+)\./.exec(text);
  if (!main || !extra) throw new Error("240-6(a): no se encontró la lista de valores.");
  const parse = (s: string) => s.split(/,| y /).map((x) => Number(x.trim())).filter((x) => x > 0);
  const inverseTimeA = expectCount(parse(main[1]!), 40, "240-6(a) valores estándar");
  const additionalFuseA = expectCount(parse(extra[1]!), 5, "240-6(a) valores adicionales de fusibles");
  return {
    id: `${SOURCE_ID}/art-240-6-a`,
    norm: NORM,
    kind: "standard-ratings",
    reference: {
      table: "240-6(a)",
      article: "240-6(a)",
      title: "Capacidades estandarizadas de fusibles e interruptores automáticos de disparo fijo",
    },
    source: source(lines),
    data: { inverseTimeA, additionalFuseA },
    notes: [
      "Se permitirá el uso de fusibles e interruptores automáticos de tiempo inverso con valores en amperes no estandarizados.",
      "A diferencia del NEC, la lista incluye 16, 32 y 63 A.",
    ],
    errata: [],
  };
}

// ---------------------------------------------------------------- 250-122

function egc(): NormTable {
  const lines = src.section(/^Tabla 250-122\.-/, /^Para cumplir con lo establecido en 250-4/);
  const rows = [];
  for (const l of lines) {
    const t = cells(l.text);
    if (t.length !== 5 || !/^\d+$/.test(t[0]!) || !isNumber(t[1]!) || !isDesignation(t[2]!)) continue;
    rows.push({
      maxRatingA: Number(t[0]),
      cu: { designation: t[2]!, system: sizeSystem(t[2]!), areaMm2: Number(t[1]) },
      al: t[3] === "-" ? null : { designation: t[4]!, system: sizeSystem(t[4]!), areaMm2: Number(t[3]) },
    });
  }
  expectCount(rows, 19, "Tabla 250-122");
  return {
    id: `${SOURCE_ID}/tabla-250-122`,
    norm: NORM,
    kind: "egc-size",
    reference: {
      table: "Tabla 250-122",
      article: "250-122",
      title: "Tamaño mínimo de los conductores de puesta a tierra para canalizaciones y equipos",
    },
    source: source(lines),
    data: { rows },
    notes: [
      "Capacidad o ajuste del dispositivo automático de protección contra sobrecorriente en el circuito antes de los equipos, canalizaciones, etc., sin exceder de (amperes).",
      "Para cumplir con lo establecido en 250-4(a)(5) o (b)(4), el conductor de puesta a tierra de equipos podría ser de mayor tamaño que lo especificado en esta Tabla.",
      "250-122(a): no se exigirá que sean mayores que los conductores del circuito. 250-122(b): incremento proporcional si se incrementan los conductores de fase.",
    ],
    errata: [],
  };
}

// ---------------------------------------------------------------- Motores: corriente a plena carga

const HP_GLYPHS: Record<string, string> = { "¼": "1/4", "⅓": "1/3", "½": "1/2", "¾": "3/4" };
function hpFrom(tokens: string[]): string {
  return tokens.map((t) => HP_GLYPHS[t] ?? t).join(" ");
}

function motorFlc(opts: {
  heading: RegExp;
  end: RegExp;
  file: string;
  table: string;
  title: string;
  motorKind: "cc" | "1F" | "3F";
  groups: { id: string; label: string; voltagesV: number[] }[];
  expected: number;
  notes: string[];
  fix?: (hp: string, kW: number, values: (number | null)[], raw: string[], line: SourceLine) => (number | null)[] | null;
  errata?: { hp: string; group: string; voltageV: number; asPublished: number; corrected: number; reason: string }[];
}): NormTable {
  const lines = src.section(opts.heading, opts.end);
  const nValues = opts.groups.reduce((s, g) => s + g.voltagesV.length, 0);
  const rows = [];
  const notes = [...opts.notes];
  for (const l of lines) {
    const t = cells(l.text);
    if (t.length < 3 || !isNumber(t[0]!)) continue;
    const kW = Number(t[0]);
    // Los valores son los últimos tokens; la potencia en hp ocupa uno o dos tokens ("1 ½").
    let values: (number | null)[] | null = null;
    let hp = "";
    for (const hpLen of [1, 2]) {
      const rest = t.slice(1 + hpLen);
      const hpTokens = t.slice(1, 1 + hpLen);
      if (rest.length === nValues && rest.every(isCell) && hpTokens.every((h) => /^\d+$/.test(h) || h in HP_GLYPHS)) {
        values = rest.map(cellValue);
        hp = hpFrom(hpTokens);
        break;
      }
    }
    if (opts.fix) {
      const fixed = opts.fix(hp, kW, values ?? [], t, l);
      if (fixed) {
        values = fixed;
        hp = hp || hpFrom(t.slice(1, 2));
      }
    }
    if (!values) continue;
    if (opts.motorKind === "1F" && kW === 0.12 && hp === "16") {
      hp = "1/6";
      notes.push("El primer renglón (0.12 kW) se lee \"16\" en la capa de texto del PDF porque la fracción 1⁄6 se compone de glifos separados; corresponde a 1/6 hp.");
    }
    let offset = 0;
    const currentsA: Record<string, (number | null)[]> = {};
    for (const g of opts.groups) {
      currentsA[g.id] = values.slice(offset, offset + g.voltagesV.length);
      offset += g.voltagesV.length;
    }
    rows.push({ hp, kW, currentsA });
  }
  expectCount(rows, opts.expected, opts.table);

  const errata = [];
  for (const e of opts.errata ?? []) {
    const i = rows.findIndex((r) => r.hp === e.hp);
    const g = opts.groups.find((x) => x.id === e.group)!;
    const j = g.voltagesV.indexOf(e.voltageV);
    const arr = rows[i]?.currentsA[e.group];
    if (!arr || arr[j] !== e.asPublished) {
      throw new Error(`${opts.table}: la errata ${e.hp} hp / ${e.voltageV} V no coincide con el texto publicado.`);
    }
    arr[j] = e.corrected;
    errata.push({ path: `rows[${i}].currentsA.${e.group}[${j}]`, asPublished: e.asPublished, corrected: e.corrected, reason: e.reason, ...APPROVAL });
  }

  return {
    id: `${SOURCE_ID}/${opts.file}`,
    norm: NORM,
    kind: "motor-flc",
    reference: { table: opts.table, article: "430-6(a)(1)", title: opts.title },
    source: source(lines),
    data: { motorKind: opts.motorKind, groups: opts.groups, rows },
    notes,
    errata,
  };
}

// ---------------------------------------------------------------- 430-52

function motorProtection(): NormTable {
  const lines = src.section(/^Tabla 430-52\.-/, /^Para algunas excepciones/);
  const labels = [
    ["monofasico", "Motores monofásicos"],
    ["polifasico-ca", "Motores polifásicos de corriente alterna distintos a los de rotor devanado"],
    ["jaula", "De jaula de ardilla: diferentes de los de diseño B energéticamente eficientes"],
    ["jaula-b-eficiente", "De diseño B energéticamente eficientes"],
    ["sincrono", "Sincrónicos (nota 3)"],
    ["rotor-devanado", "Con rotor devanado"],
    ["cc", "De corriente continua (tensión constante)"],
  ] as const;
  const numeric = lines.filter((l) => {
    const t = cells(l.text);
    return t.length >= 4 && t.slice(-4).every(isNumber);
  });
  expectCount(numeric, labels.length, "Tabla 430-52");
  const rows = numeric.map((l, i) => ({
    motorType: labels[i]![0],
    label: labels[i]![1],
    percents: cells(l.text).slice(-4).map(Number),
  }));
  return {
    id: `${SOURCE_ID}/tabla-430-52`,
    norm: NORM,
    kind: "motor-protection",
    reference: {
      table: "Tabla 430-52",
      article: "430-52",
      title: "Ajuste máximo de los dispositivos de protección contra cortocircuito y falla a tierra para circuitos derivados de motores",
    },
    source: source(lines),
    data: {
      devices: [
        { id: "fusible-sin-retardo", label: "Fusible sin retardo de tiempo¹" },
        { id: "fusible-doble-elemento", label: "Fusible de dos elementos¹ (con retardo de tiempo)" },
        { id: "instantaneo", label: "Interruptor automático de disparo instantáneo" },
        { id: "itm", label: "Interruptor automático de tiempo inverso²" },
      ],
      rows,
    },
    notes: [
      "En porcentaje de la corriente a plena carga.",
      "¹ Los valores de la columna fusible sin retardo de tiempo se aplican a fusibles de Clase CC de acción retardada.",
      "² Los valores de la última columna también cubren los valores nominales de los interruptores automáticos de tiempo inverso no ajustables, que se pueden modificar como se describe en 430-52(c)(1), Excepción 1 y 2.",
      "³ Los motores sincrónicos de bajo par y baja velocidad (usualmente 450 rpm o menos) que arrancan sin carga no requieren más del 200 por ciento de la corriente a plena carga.",
      "Para algunas excepciones a los valores especificados, ver 430-54. Excepciones de 430-52(c)(1): valor inmediato superior y aumentos máximos.",
    ],
    errata: [],
  };
}

// ---------------------------------------------------------------- 430-22(e)

function dutyCycle(): NormTable {
  const lines = src.section(/^Tabla 430-22\(e\)\.-/, /^Cualquier motor debe ser considerado/);
  const labels = [
    ["corta-duracion", "Servicio de corto tiempo: accionamiento de válvulas, elevación o descenso de rodillos, etc."],
    ["intermitente", "Servicio intermitente: elevadores y montacargas, máquinas de herramientas, bombas, puentes levadizos, plataformas giratorias, etc."],
    ["periodico", "Servicio periódico: rodillos, máquinas de manipulación de minerales y carbón, etc."],
    ["variable", "Servicio variable"],
  ] as const;
  const numeric = lines.filter((l) => {
    const t = cells(l.text);
    return t.length >= 4 && t.slice(-4).every(isCell) && t.slice(-4).some(isNumber);
  });
  expectCount(numeric, labels.length, "Tabla 430-22(e)");
  return {
    id: `${SOURCE_ID}/tabla-430-22-e`,
    norm: NORM,
    kind: "duty-cycle",
    reference: { table: "Tabla 430-22(e)", article: "430-22(e)", title: "Servicio por régimen de tiempo" },
    source: source(lines),
    data: {
      ratings: [
        { id: "5min", label: "Motor especificado para 5 minutos" },
        { id: "15min", label: "Motor especificado para 15 minutos" },
        { id: "30-60min", label: "Motor especificado para 30 y 60 minutos" },
        { id: "continuo", label: "Motor especificado para funcionamiento continuo" },
      ],
      rows: numeric.map((l, i) => ({
        dutyClass: labels[i]![0],
        label: labels[i]![1],
        percents: cells(l.text).slice(-4).map(cellValue),
      })),
    },
    notes: [
      "Porcentajes del valor nominal de corriente de las placas de características.",
      "Cualquier motor debe ser considerado como de ciclo continuo, a menos que la naturaleza de los aparatos que accione sea tal que el motor no operará continuamente con carga bajo cualquier condición de operación.",
      "Para soldadoras de arco, ver 630-11.",
    ],
    errata: [],
  };
}

// ---------------------------------------------------------------- Capítulo 10, Tabla 8

function conductorProperties(): NormTable {
  const lines = src.section(/^Tabla 8\.- Propiedades de los conductores/, /^Notas$/);
  const rows = [];
  for (const l of lines) {
    const t = cells(l.text);
    if (t.length !== 10 || !isDesignation(t[0]!) || !isNumber(t[1]!)) continue;
    const v = t.map((x) => (isCell(x) ? cellValue(x) : NaN));
    if (v.slice(5, 9).some((x) => x === null || Number.isNaN(x))) continue;
    rows.push({
      designation: t[0]!,
      system: sizeSystem(t[0]!),
      areaMm2: v[1]!,
      areaCmil: v[2] ?? null,
      strands: v[3]!,
      strandDiameterMm: v[4] ?? null,
      overallDiameterMm: v[5]!,
      overallAreaMm2: v[6]!,
      dcResistanceOhmPerKm: { cu: v[7]!, cuCoated: v[8]!, al: v[9] ?? null },
    });
  }
  expectCount(rows, 36, "Capítulo 10, Tabla 8");
  return {
    id: `${SOURCE_ID}/cap10-tabla-8`,
    norm: NORM,
    kind: "conductor-properties",
    reference: { table: "Capítulo 10, Tabla 8", article: "Capítulo 10", title: "Propiedades de los conductores" },
    source: source(lines),
    data: { temperatureC: 75, rows },
    notes: [
      "(1) Estos valores de resistencia son válidos solamente para los parámetros indicados. Al usar conductores con hilos recubiertos, de distinto tipo de trenzado y especialmente a otras temperaturas, cambia la resistencia.",
      "(2) Fórmula para el cambio de temperatura: R2 = R1 [1 + α (T2 − 75)], donde αCu = 0.00323, αAl = 0.00330 a 75 °C.",
      "(3) Los conductores con cableado compacto o comprimido tienen aproximadamente un 9 % y un 3 %, respectivamente, menos de diámetro del conductor desnudo que los conductores mostrados.",
      "(4) Las conductividades usadas, según la IACS: cobre desnudo = 100 %, aluminio = 61 %.",
      "Calibres 18 a 8 AWG aparecen en dos renglones: sólido (1 hilo) y cableado (7 hilos).",
    ],
    errata: [
      {
        path: "notes[1]",
        asPublished: "R2 = R1 [1 + (T2 - 75)]",
        corrected: "R2 = R1 [1 + α (T2 − 75)]",
        reason: "Falta el símbolo α en la fórmula publicada; la propia nota da αCu = 0.00323 y αAl = 0.00330.",
        ...APPROVAL,
      },
    ],
  };
}

// ---------------------------------------------------------------- Capítulo 10, Tabla 9

function acImpedance(): NormTable {
  const lines = src.section(/^Tabla 9\.- Resistencia y reactancia en corriente alterna/, /^Notas:$/);
  const rows = [];
  for (const l of lines) {
    const t = cells(l.text);
    if (t.length !== 16 || !isNumber(t[0]!) || !isDesignation(t[1]!) || !t.slice(2).every(isCell)) continue;
    const v = t.slice(2).map(cellValue);
    const triple = (i: number) => ({ pvc: v[i]!, aluminio: v[i + 1]!, acero: v[i + 2]! });
    rows.push({
      designation: t[1]!,
      system: sizeSystem(t[1]!),
      areaMm2: Number(t[0]),
      xlOhmPerKm: { pvcOAluminio: v[0]!, acero: v[1]! },
      rCuOhmPerKm: triple(2),
      rAlOhmPerKm: triple(5),
      zCuOhmPerKm: triple(8),
      zAlOhmPerKm: triple(11),
    });
  }
  expectCount(rows, 21, "Capítulo 10, Tabla 9");
  return {
    id: `${SOURCE_ID}/cap10-tabla-9`,
    norm: NORM,
    kind: "ac-impedance",
    reference: {
      table: "Capítulo 10, Tabla 9",
      article: "Capítulo 10",
      title: "Resistencia y reactancia en corriente alterna para los cables para 600 volts, 3 fases a 60 Hz y 75 °C. Tres conductores individuales en un tubo conduit",
    },
    source: source(lines),
    data: { temperatureC: 75, frequencyHz: 60, powerFactorForZ: 0.85, rows },
    notes: [
      "Ohms al neutro por kilómetro.",
      "1. Valores basados en conductores tipo RHH con trenzado Clase B, en configuración acunada. Conductividad 100 % IACS (cobre), 61 % IACS (aluminio); conduit de aluminio 45 % IACS. No se tiene en cuenta la reactancia capacitiva. Resistencias válidas sólo a 75 °C.",
      "2. Ze = R cos θ + X sen θ. Al multiplicar la corriente por la impedancia eficaz se obtiene una buena aproximación de la caída de tensión de línea a neutro. Para otro FP: Ze = R × FP + XL sen[arc cos(FP)].",
      "Orden de columnas interpretado (encabezados desordenados en la capa de texto): XL (PVC o aluminio, acero); R Cu (PVC, aluminio, acero); R Al (…); Z Cu a FP 0.85 (…); Z Al (…). Comprobado con 4/0 Cu: R = 0.203/0.220/0.207 Ω/km = 0.062/0.067/0.063 Ω/kft (NEC) × 3.281.",
    ],
    errata: [],
  };
}

// ---------------------------------------------------------------- Ejecución

const IND = "induccion";
const tables: NormTable[] = [
  ampacity(
    /^Tabla 310-15\(b\)\(16\)\.-/,
    "tabla-310-15-b-16",
    "Tabla 310-15(b)(16)",
    "Ampacidades permisibles en conductores aislados para tensiones hasta 2000 volts y 60 °C a 90 °C. No más de tres conductores portadores de corriente en una canalización, cable o directamente enterrados, basados en una temperatura ambiente de 30 °C",
    false,
  ),
  ampacity(
    /^Tabla 310-15\(b\)\(17\)\.-/,
    "tabla-310-15-b-17",
    "Tabla 310-15(b)(17)",
    "Ampacidades permisibles de conductores individuales aislados para tensiones hasta e incluyendo 2000 volts al aire libre, basadas en una temperatura ambiente de 30 °C",
    true,
  ),
  temperatureCorrection(/^Tabla 310-15\(b\)\(2\)\(a\)\.-/, /^Tabla 310-15\(b\)\(2\)\(b\)\.-/, "tabla-310-15-b-2-a", "Tabla 310-15(b)(2)(a)", 30, [60, 75, 90], 16),
  temperatureCorrection(/^Tabla 310-15\(b\)\(2\)\(b\)\.-/, /^3\) Factores de ajuste\.$/, "tabla-310-15-b-2-b", "Tabla 310-15(b)(2)(b)", 40, [60, 75, 90, 150, 200, 250], 25),
  adjustmentFactors(),
  standardRatings(),
  egc(),
  motorFlc({
    heading: /^Tabla 430-247\.-/,
    end: /^\* Estos valores son promedios/,
    file: "tabla-430-247",
    table: "Tabla 430-247",
    title: "Corriente a plena carga para motores de corriente continua",
    motorKind: "cc",
    groups: [{ id: "armadura", label: "Tensión nominal de armadura", voltagesV: [120, 240, 500] }],
    expected: 23,
    notes: ["Los valores de corriente a plena carga son para motores que funcionan a su velocidad básica.", "* Estos valores son promedios para corriente continua."],
    errata: [
      {
        hp: "150",
        group: "armadura",
        voltageV: 500,
        asPublished: 346,
        corrected: 246,
        reason: "346 A excede el valor de 200 hp (330 A) y rompe la secuencia; NEC 430.247 da 246 A.",
      },
    ],
  }),
  motorFlc({
    heading: /^Tabla 430-248\.-/,
    end: /^Tabla 430-249\.-/,
    file: "tabla-430-248",
    table: "Tabla 430-248",
    title: "Corriente a plena carga de motores monofásicos de corriente alterna",
    motorKind: "1F",
    groups: [{ id: "monofasico", label: "Tensión nominal del motor", voltagesV: [115, 127, 208, 230] }],
    expected: 12,
    notes: [
      "Valores para motores que funcionan a la velocidad usual y con características normales de par.",
      "Las corrientes listadas deben utilizarse para sistemas de tensiones nominales de 110 a 120 volts y de 220 a 240 volts.",
    ],
  }),
  motorFlc({
    heading: /^Tabla 430-250\.-/,
    end: /^\*Para factores de potencia de 90/,
    file: "tabla-430-250",
    table: "Tabla 430-250",
    title: "Corriente a plena carga de motores trifásicos de corriente alterna",
    motorKind: "3F",
    groups: [
      { id: IND, label: "Inducción jaula de ardilla y rotor devanado", voltagesV: [115, 200, 208, 230, 460, 575, 2300] },
      { id: "sincrono-fp1", label: "Síncrono de factor de potencia unitario*", voltagesV: [230, 460, 575, 2300] },
    ],
    expected: 27,
    notes: [
      "Valores típicos para motores que funcionan a las velocidades usuales de motores con bandas y con características normales de par.",
      "Las corrientes enumeradas se permitirán para sistemas con intervalos de tensión de 110 a 120 volts, 220 a 240 volts, 440 a 480 volts y 550 a 600 volts.",
      "* Para factores de potencia de 90 por ciento y 80 por ciento, las cifras de los motores síncronos se deben multiplicar respectivamente por 1.10 y 1.25.",
      "Renglón de 250 hp: la capa de texto no conserva las celdas vacías; las columnas se asignaron por coordenada horizontal en la página 406 (302 A → 460 V, 242 A → 575 V, 60 A → 2300 V; demás vacías).",
    ],
    fix: (hp, kW, values, raw) => {
      if (kW !== 187 || raw[1] !== "250") return null;
      // Texto: "187 | 250 | - | 302 | 242 | 60 | - | - | - | -". Ver nota del renglón de 250 hp.
      const expected = ["187", "250", "-", "302", "242", "60", "-", "-", "-", "-"];
      if (raw.join(" ") !== expected.join(" ")) throw new Error("Tabla 430-250: el renglón de 250 hp cambió respecto a lo revisado.");
      void hp;
      void values;
      return [null, null, null, null, 302, 242, 60, null, null, null, null];
    },
    errata: [
      {
        hp: "10",
        group: IND,
        voltageV: 575,
        asPublished: 44,
        corrected: 11,
        reason: "44 A rompe la secuencia (7 1/2 hp = 9 A, 15 hp = 17 A); NEC 430.250 da 11 A.",
      },
      {
        hp: "40",
        group: "sincrono-fp1",
        voltageV: 230,
        asPublished: 93,
        corrected: 83,
        reason: "I·V se aparta 13 % del renglón (460 V = 41 A, 575 V = 33 A); secuencia 30 hp = 63 A → 50 hp = 104 A; NEC 430.250 da 83 A.",
      },
    ],
  }),
  motorProtection(),
  dutyCycle(),
  conductorProperties(),
  acImpedance(),
];

mkdirSync(OUT_DIR, { recursive: true });
for (const t of tables) {
  normTableSchema.parse(t);
  const file = `${OUT_DIR}${t.id.split("/")[1]}.json`;
  writeFileSync(file, `${JSON.stringify(t, null, 2)}\n`, "utf8");
  console.log(`✓ ${t.reference.table.padEnd(28)} ${String(t.data && "rows" in t.data ? t.data.rows.length : "").padStart(3)} renglones  p. ${t.source.pages.join(", ")}`);
}
writeCatalogAndReport();
