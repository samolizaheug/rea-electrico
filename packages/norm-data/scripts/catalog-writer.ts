/**
 * Regenera:
 * - src/catalog.ts: índice estático de todos los JSON en data/ (para que el navegador los empaquete).
 * - docs/tablas/<norma>.md: reporte legible de cada tabla para revisarla contra el PDF.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fingerprint } from "../src/fingerprint";
import { normTableSchema, verificationFileSchema, type NormTable, type VerificationFile } from "../src/schema";
import { DATA_DIR, REPO_ROOT } from "./sources";

const CATALOG = new URL("../src/catalog.ts", import.meta.url);
const REPORT_DIR = `${REPO_ROOT}docs/tablas/`;

export function writeCatalogAndReport(): void {
  const datasets = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const imports: string[] = [];
  const entries: string[] = [];
  let n = 0;
  for (const ds of datasets) {
    const dir = `${DATA_DIR}${ds}/`;
    const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "verificacion.json").sort();
    const tableVars: string[] = [];
    for (const f of files) {
      const v = `t${n++}`;
      imports.push(`import ${v} from "../data/${ds}/${f}";`);
      tableVars.push(v);
    }
    const vv = `v${n++}`;
    if (!existsSync(`${dir}verificacion.json`)) {
      const [id, edition] = splitDataset(ds);
      writeFileSync(`${dir}verificacion.json`, `${JSON.stringify({ norm: { id, edition }, tables: {} }, null, 2)}\n`, "utf8");
    }
    imports.push(`import ${vv} from "../data/${ds}/verificacion.json";`);
    entries.push(`  ${JSON.stringify(ds)}: { tables: [${tableVars.join(", ")}], verification: ${vv} },`);
    writeReport(ds, files.map((f) => normTableSchema.parse(JSON.parse(readFileSync(`${dir}${f}`, "utf8"))) as NormTable),
      verificationFileSchema.parse(JSON.parse(readFileSync(`${dir}verificacion.json`, "utf8"))));
  }

  const body = [
    "// Archivo generado por packages/norm-data/scripts/catalog-writer.ts. No editar a mano.",
    ...imports,
    "",
    "export const rawCatalog: Record<string, { tables: unknown[]; verification: unknown }> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
  writeFileSync(CATALOG, body, "utf8");
  console.log(`Índice: ${datasets.length} conjunto(s) de datos → src/catalog.ts; reporte → docs/tablas/`);
}

/** "nom-001-sede-2012" → ["nom-001-sede", "2012"]. */
export function splitDataset(ds: string): [string, string] {
  const m = /^(.*)-(\d{4})$/.exec(ds);
  if (!m) throw new Error(`Nombre de conjunto de datos inválido: ${ds} (se espera <norma>-<año>).`);
  return [m[1]!, m[2]!];
}

// ---------------------------------------------------------------- Reporte Markdown

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "–" : String(v));
const size = (r: { designation: string; system: string; areaMm2: number | null }) =>
  `${r.designation} ${r.system === "AWG" ? "AWG" : r.system} (${fmt(r.areaMm2)} mm²)`;

function mdTable(head: string[], rows: string[][]): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function renderData(t: NormTable): string {
  switch (t.kind) {
    case "ampacity":
      return mdTable(
        ["Calibre", ...t.data.temperaturesC.map((c) => `Cu ${c} °C`), ...t.data.temperaturesC.map((c) => `Al ${c} °C`), "**"],
        t.data.rows.map((r) => [size(r), ...r.cu.map(fmt), ...r.al.map(fmt), r.smallConductorLimit ? "**" : ""]),
      );
    case "temperature-correction":
      return mdTable(
        ["Temp. ambiente °C", ...t.data.temperaturesC.map((c) => `${c} °C`)],
        t.data.rows.map((r) => [r.ambientFromC === null ? `${r.ambientToC} o menos` : `${r.ambientFromC}-${r.ambientToC}`, ...r.factors.map(fmt)]),
      );
    case "adjustment-factors":
      return mdTable(
        ["Número de conductores", "% del valor de tabla"],
        t.data.rows.map((r) => [r.conductorsTo === null ? `${r.conductorsFrom} y más` : `${r.conductorsFrom}-${r.conductorsTo}`, String(r.percent)]),
      );
    case "standard-ratings":
      return `**Tiempo inverso (A):** ${t.data.inverseTimeA.join(", ")}\n\n**Adicionales para fusibles (A):** ${t.data.additionalFuseA.join(", ")}`;
    case "egc-size":
      return mdTable(
        ["Protección hasta (A)", "Cobre", "Aluminio"],
        t.data.rows.map((r) => [String(r.maxRatingA), size(r.cu), r.al ? size(r.al) : "–"]),
      );
    case "motor-flc":
      return mdTable(
        ["hp", "kW", ...t.data.groups.flatMap((g) => g.voltagesV.map((v) => `${g.id} ${v} V`))],
        t.data.rows.map((r) => [r.hp, String(r.kW), ...t.data.groups.flatMap((g) => (r.currentsA[g.id] ?? []).map(fmt))]),
      );
    case "motor-protection":
      return mdTable(["Tipo de motor", ...t.data.devices.map((d) => d.label)], t.data.rows.map((r) => [r.label, ...r.percents.map(String)]));
    case "duty-cycle":
      return mdTable(["Clasificación del servicio", ...t.data.ratings.map((r) => r.label)], t.data.rows.map((r) => [r.label, ...r.percents.map(fmt)]));
    case "conductor-properties":
      return mdTable(
        ["Calibre", "kcmil", "Hilos", "Ø hilo mm", "Ø total mm", "Área total mm²", "R cc Cu Ω/km", "R cc Cu rec. Ω/km", "R cc Al Ω/km"],
        t.data.rows.map((r) => [
          size(r), fmt(r.areaCmil), String(r.strands), fmt(r.strandDiameterMm), String(r.overallDiameterMm), String(r.overallAreaMm2),
          String(r.dcResistanceOhmPerKm.cu), String(r.dcResistanceOhmPerKm.cuCoated), fmt(r.dcResistanceOhmPerKm.al),
        ]),
      );
    case "ac-impedance": {
      const tri = (x: { pvc: number | null; aluminio: number | null; acero: number | null }) => [fmt(x.pvc), fmt(x.aluminio), fmt(x.acero)];
      return mdTable(
        ["Calibre", "XL PVC/Al", "XL acero", "R Cu PVC", "R Cu Al", "R Cu acero", "R Al PVC", "R Al Al", "R Al acero", "Z Cu PVC", "Z Cu Al", "Z Cu acero", "Z Al PVC", "Z Al Al", "Z Al acero"],
        t.data.rows.map((r) => [size(r), String(r.xlOhmPerKm.pvcOAluminio), String(r.xlOhmPerKm.acero), ...tri(r.rCuOhmPerKm), ...tri(r.rAlOhmPerKm), ...tri(r.zCuOhmPerKm), ...tri(r.zAlOhmPerKm)]),
      );
    }
    case "insulation-types":
      return mdTable(
        ["Tipo", "Nombre genérico", "Temperatura y lugares", "Nota"],
        t.data.rows.map((r) => [r.type, r.genericName, r.ratings.map((x) => `${x.temperatureC} °C: ${x.locations}`).join("; "), r.note ?? ""]),
      );
    case "raceway-dimensions":
      return t.data.sections
        .map(
          (s) =>
            `**${s.label}** (Art. ${s.article}; título publicado: "${s.publishedTitle}")\n\n` +
            mdTable(
              ["Designación", "Comercial", "Ø int. mm", "100 % mm²", "60 % mm²", "1 cond. 53 % mm²", "2 cond. 31 % mm²", "> 2 cond. 40 % mm²"],
              s.rows.map((r) => [String(r.metricDesignation), r.tradeSize, fmt(r.internalDiameterMm), fmt(r.totalAreaMm2), fmt(r.area60Mm2), fmt(r.fill1Mm2), fmt(r.fill2Mm2), fmt(r.fillOver2Mm2)]),
            ),
        )
        .join("\n\n");
    case "tray-fill":
      return mdTable(
        ["Ancho cm", "Escalera/malla/ventilada col. 1 mm²", "Col. 2", "Fondo sólido col. 3 mm²", "Col. 4"],
        t.data.rows.map((r) => [String(r.widthCm), String(r.ladderMm2), `${r.ladderMm2} − ${r.ladderSdFactor}·Sd`, String(r.solidMm2), `${r.solidMm2} − ${r.solidSdFactor}·Sd`]),
      );
    case "demand-factors":
      return mdTable(
        ["Inmueble / carga", "Porción (texto publicado)", "Hasta VA (acumulado)", "Factor %"],
        t.data.rows.flatMap((r) => r.tiers.map((x, i) => [i === 0 ? r.label : "", x.publishedText, fmt(x.upToVA), String(x.percent)])),
      );
  }
}

function writeReport(ds: string, tables: NormTable[], verification: VerificationFile): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  const out: string[] = [
    `# Tablas normativas: ${ds}`,
    "",
    "> Archivo generado por `packages/norm-data/scripts/catalog-writer.ts`. No editar a mano.",
    "> Úsalo para revisar cada tabla contra el PDF fuente; las páginas son del PDF unido.",
    "",
    "| Tabla | Páginas | Método | Erratas | Estado |",
    "|---|---|---|---|---|",
  ];
  for (const t of tables) {
    out.push(`| [${t.reference.table}](#${anchor(t)}) | ${t.source.pages.join(", ")} | ${t.source.method} | ${t.errata.length} | ${statusOf(t, verification)} |`);
  }
  for (const t of tables) {
    out.push(
      "",
      `<a id="${anchor(t)}"></a>`,
      `## ${t.reference.table}`,
      "",
      `**${t.reference.title}**`,
      "",
      `- Id: \`${t.id}\` · Artículo: ${t.reference.article} · Páginas del PDF: ${t.source.pages.join(", ")} · Método: ${t.source.method}`,
      `- Estado: ${statusOf(t, verification)} · Huella de datos: \`${fingerprint(t.data).slice(0, 16)}…\``,
      "",
      renderData(t),
    );
    if (t.notes.length) out.push("", "**Notas:**", "", ...t.notes.map((n) => `- ${n}`));
    if (t.errata.length) {
      out.push("", "**Erratas aplicadas:**", "", mdTable(["Ubicación", "Publicado", "Corregido", "Motivo", "Aprobó"],
        t.errata.map((e) => [e.path, String(e.asPublished), String(e.corrected), e.reason, `${e.approvedBy}, ${e.approvedAt}`])));
    }
  }
  writeFileSync(`${REPORT_DIR}${ds}.md`, `${out.join("\n")}\n`, "utf8");
}

function anchor(t: NormTable): string {
  return t.id.split("/")[1]!;
}

function statusOf(t: NormTable, v: VerificationFile): string {
  const entry = v.tables[t.id.split("/")[1]!];
  if (!entry) return "por verificar";
  if (entry.fingerprint !== fingerprint(t.data)) return "por verificar (los datos cambiaron después de la verificación)";
  return `${entry.status.replace("_", " ")} (${entry.by}, ${entry.date})`;
}
