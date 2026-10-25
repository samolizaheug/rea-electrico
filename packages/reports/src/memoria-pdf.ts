import type { Content, ContentTable, CustomTableLayout, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { PanelSchedule, TraceStep } from "@rea/engine";
import { circuitRows, elementReports, fmt, fmtDate, isDraft, issueSeverityByElement, normTables, type ReportInput } from "./data";
import { diagramSvg } from "./diagram-svg";
import { rs } from "./strings";
import { toDisplayLength, type DisplayUnits } from "./units";

/**
 * Memoria de cálculo en PDF (definición de pdfmake). Contenido:
 * datos y criterios, unifilar, cédula de conductores, cuadros de carga, memoria paso a paso
 * por elemento, observaciones, tablas normativas con su estado de verificación y firmas.
 * La definición es independiente del entorno: se imprime con pdfmake en el navegador o en Node.
 */

const GRID: CustomTableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => "#9aa3ad",
  vLineColor: () => "#9aa3ad",
  paddingLeft: () => 3,
  paddingRight: () => 3,
  paddingTop: () => 2,
  paddingBottom: () => 2,
  fillColor: (row: number) => (row === 0 ? "#e8edf3" : null),
};

const KEYVALUE: CustomTableLayout = { ...GRID, fillColor: () => null };

const th = (text: string, alignment: "left" | "right" | "center" = "left"): TableCell => ({ text, style: "th", alignment });
const td = (text: string | number | undefined, alignment: "left" | "right" | "center" = "left"): TableCell => ({ text: text === undefined ? "—" : String(text), alignment });
const num = (v: number | undefined, d = 1): TableCell => td(fmt(v, d), "right");
const numB = (v: number | undefined, d = 1): TableCell => ({ text: fmt(v, d), alignment: "right", bold: true });

function keyValue(rows: [string, string][]): ContentTable {
  return {
    table: { widths: [170, "*"], body: rows.map(([k, v]) => [{ text: k, bold: true }, v || "—"]) },
    layout: KEYVALUE,
    margin: [0, 0, 0, 8],
  };
}

function stepContent(s: TraceStep): Content {
  return {
    unbreakable: true,
    margin: [0, 0, 0, 4],
    stack: [
      { text: s.label, bold: true },
      ...(s.formula ? [{ text: s.formula, color: "#1d3f73", margin: [8, 1, 0, 0] as [number, number, number, number] }] : []),
      ...(s.substitution ? [{ text: s.substitution, margin: [8, 1, 0, 0] as [number, number, number, number] }] : []),
      { text: s.result, bold: true, margin: [8, 1, 0, 0] },
      ...(s.refs?.length ? [{ text: s.refs.join(" · "), style: "refs", margin: [8, 1, 0, 0] as [number, number, number, number] }] : []),
    ],
  };
}

function scheduleTable(s: PanelSchedule, u: DisplayUnits): Content[] {
  const ln = s.vNomLL / Math.sqrt(3);
  const body: TableCell[][] = [
    [th(rs("circuit")), th(rs("fedBy")), th(rs("phases"), "center"), th("A (VA)", "right"), th("B (VA)", "right"), th("C (VA)", "right"), th(`${rs("total")} (VA)`, "right"), th("I (A)", "right"), th(rs("protection"), "right"), th(rs("conductor")), th(rs("length", { unit: u.length }), "right"), th(rs("dropPct"), "right")],
    ...s.rows.map((r) => [
      td(r.circuit),
      td(r.description),
      td(r.phases, "center"),
      num(r.va.a, 0),
      num(r.va.b, 0),
      num(r.va.c, 0),
      num(r.totalVA, 0),
      num(r.currentA, 2),
      td(r.protectionA !== undefined ? `${r.protectionA}${r.poles ? ` / ${r.poles}P` : ""}` : "—", "right"),
      td(r.conductor),
      num(r.lengthM === undefined ? undefined : toDisplayLength(r.lengthM, u), 0),
      num(r.dropPct, 2),
    ]),
    [
      { text: rs("totals"), bold: true, colSpan: 3 },
      "",
      "",
      numB(s.totals.va.a, 0),
      numB(s.totals.va.b, 0),
      numB(s.totals.va.c, 0),
      numB(s.totals.totalVA, 0),
      { text: `${fmt(s.totals.pKW, 2)} kW · ${fmt(s.totals.qKvar, 2)} kvar · FP ${fmt(s.totals.pf, 3)}`, colSpan: 5 },
      "",
      "",
      "",
      "",
    ],
    [
      { text: rs("phaseCurrent"), bold: true, colSpan: 3 },
      "",
      "",
      num(s.totals.currentA.a, 2),
      num(s.totals.currentA.b, 2),
      num(s.totals.currentA.c, 2),
      {
        text: `${rs("unbalanceShort")}: ${fmt(s.totals.unbalancePct, 2)} %${s.totals.unbalanceLimitPct !== undefined ? ` (${rs("limit")} ${s.totals.unbalanceLimitPct} %)` : ""}`,
        colSpan: 6,
        bold: s.totals.unbalanceExceeded,
        color: s.totals.unbalanceExceeded ? "#b26b00" : undefined,
      },
      "",
      "",
      "",
      "",
      "",
    ],
  ];
  return [
    { text: `${s.tag} — ${fmt(s.vNomLL, 0)}${s.system === "3F4H" ? `Y/${fmt(ln, 0)}` : ""} V · ${s.system ?? ""}`, style: "h3", headlineLevel: 1 },
    { table: { headerRows: 1, dontBreakRows: true, widths: [42, "*", 28, 44, 44, 44, 50, 38, 48, 70, 30, 38], body }, layout: GRID, fontSize: 7.5 },
    { ul: s.notes, style: "refs", margin: [0, 3, 0, 10] },
  ];
}

/** Alto / ancho del SVG (a partir de sus atributos width y height). */
export function svgAspect(svg: string): number {
  const w = Number(/\swidth="([\d.]+)"/.exec(svg)?.[1]);
  const h = Number(/\sheight="([\d.]+)"/.exec(svg)?.[1]);
  return w > 0 && h > 0 ? h / w : 1;
}

/** Unifilar solo, en una hoja doble carta (tabloide), vertical u horizontal según el dibujo. */
export function diagramPdfDocDefinition(svg: string, title: string): TDocumentDefinitions {
  // Tabloide: 792 × 1224 pt; márgenes de 24 pt.
  const tall = svgAspect(svg) > 1;
  return {
    info: { title, creator: "REA Eléctrico" },
    pageSize: "TABLOID",
    pageOrientation: tall ? "portrait" : "landscape",
    pageMargins: [24, 24, 24, 24],
    content: [{ svg, fit: tall ? [744, 1176] : [1176, 744], alignment: "center" }],
    defaultStyle: { font: "Roboto" },
  };
}

export function memoriaDocDefinition(input: ReportInput): TDocumentDefinitions {
  const { project } = input;
  const m = project.meta;
  const s = project.settings;
  const date = input.date ?? new Date();
  const draft = isDraft(input);
  const tables = normTables(input.norm);
  const circuits = circuitRows(input);
  const elements = elementReports(input);
  const issueMap = issueSeverityByElement(input.issues);
  const u = project.settings.units;

  // ---- Portada, datos y criterios.
  const intro: Content[] = [
    { text: rs("memoriaTitle"), style: "title" },
    { text: m.name, style: "subtitle" },
    { text: [m.client, m.location].filter(Boolean).join(" · "), margin: [0, 0, 0, 4] },
    { text: `${input.norm.label} · ${fmtDate(date)}`, color: "#555", margin: [0, 0, 0, 14] },
    ...(draft ? [{ table: { widths: ["*"], body: [[{ text: `${rs("draft")}: ${rs("draftReason")}`, bold: true, color: "#c62828" }]] }, layout: KEYVALUE, margin: [0, 0, 0, 12] } as Content] : []),
    { text: `1. ${rs("secProject")}`, style: "h2", headlineLevel: 1 },
    keyValue([
      [rs("name"), m.name],
      [rs("client"), m.client],
      [rs("location"), m.location],
      [rs("author"), m.author],
      [rs("description"), m.description],
    ]),
    { text: `2. ${rs("secCriteria")}`, style: "h2", headlineLevel: 1 },
    keyValue([
      [rs("norm"), input.norm.label],
      [rs("method"), (input.norm.methodNote ?? rs("methodValue"))],
      [rs("frequency"), `${s.frequencyHz} Hz`],
      [rs("ambientAir"), `${s.ambient.airC} °C`],
      [rs("ambientGround"), `${s.ambient.groundC} °C`],
      [rs("vdBranch"), `${s.voltageDrop.branchPct} %`],
      [rs("vdFeeder"), `${s.voltageDrop.feederPct} %`],
      [rs("vdTotal"), `${s.voltageDrop.totalPct} %`],
      [rs("unbalance"), `${s.phaseUnbalance.maxPct} % (${rs("unbalanceNote")})`],
      [rs("symbology"), s.symbology === "ANSI" ? "ANSI / IEEE" : "IEC"],
    ]),
  ];

  // ---- Unifilar.
  const svg = diagramSvg(project, input.registry, { results: input.sizing, issues: issueMap, norm: input.norm, draft, date });
  // Hoja vertical u horizontal según la proporción del dibujo, para aprovechar el espacio.
  const tall = svgAspect(svg) > 1;
  const diagram: Content[] = [{ text: `3. ${rs("secDiagram")}`, style: "h2", headlineLevel: 1 }, { svg, fit: tall ? [532, 640] : [712, 455], alignment: "center" }];

  // ---- Cédula de conductores.
  const circuitTable: Content[] = [
    { text: `4. ${rs("secCircuits")}`, style: "h2", headlineLevel: 1 },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [38, 44, "*", 50, 36, 36, 40, 76, 40, 40, 28, 34, 34, 52],
        body: [
          [th(rs("circuit")), th(rs("from")), th(rs("to")), th(rs("kind")), th(rs("loadA"), "right"), th(rs("designA"), "right"), th(rs("protection"), "right"), th(rs("conductor")), th(rs("egc")), th(rs("ampacity"), "right"), th(rs("length", { unit: u.length }), "right"), th(rs("dropPct"), "right"), th(rs("cumulativePct"), "right"), th(rs("governing"))],
          ...circuits.map((c) => [
            td(c.tag),
            td(c.from),
            td(c.to),
            td(c.kind),
            num(c.loadA, 2),
            num(c.designA, 2),
            td(c.protectionA, "right"),
            td(c.conductor),
            td(c.egc),
            num(c.ampacityA, 1),
            num(c.lengthM === undefined ? undefined : toDisplayLength(c.lengthM, u), 0),
            num(c.dropPct, 2),
            num(c.cumulativePct, 2),
            td(c.governing),
          ]),
        ],
      },
      layout: GRID,
      fontSize: 7.5,
    },
    { text: rs("circuitsNote"), style: "refs", margin: [0, 3, 0, 0] },
  ];

  // ---- Cuadros de carga.
  const schedules: Content[] = [{ text: `5. ${rs("secSchedules")}`, style: "h2", headlineLevel: 1 }, ...input.schedules.flatMap((x) => scheduleTable(x, u))];

  // ---- Memoria por elemento.
  const memoria: Content[] = [{ text: `6. ${rs("secMemoria")}`, style: "h2", headlineLevel: 1 }];
  for (const e of elements) {
    memoria.push({ text: `${e.tag} — ${e.typeName}`, style: "h3", headlineLevel: 1 });
    if (e.facts.length) memoria.push(keyValue(e.facts));
    for (const tr of e.traces) {
      memoria.push({ text: tr.title, bold: true, color: "#1d3f73", margin: [0, 2, 0, 3], headlineLevel: 1 });
      memoria.push({ ol: tr.steps.map(stepContent), margin: [4, 0, 0, 6] });
    }
  }

  // ---- Observaciones, tablas y firmas.
  const sev = { error: rs("error"), warning: rs("warning"), info: rs("info") } as const;
  const closing: Content[] = [
    { text: `7. ${rs("secIssues")}`, style: "h2", headlineLevel: 1 },
    input.issues.length
      ? { table: { headerRows: 1, widths: [64, "*"], body: [[th(rs("severity")), th(rs("message"))], ...input.issues.map((i) => [{ text: sev[i.severity], color: i.severity === "error" ? "#c62828" : i.severity === "warning" ? "#b26b00" : undefined, bold: i.severity !== "info" }, td(i.message)])] }, layout: GRID, margin: [0, 0, 0, 8] }
      : { text: rs("noIssues"), margin: [0, 0, 0, 8] },
    { text: `8. ${rs("secTables")}`, style: "h2", headlineLevel: 1 },
    tables.length
      ? { table: { headerRows: 1, widths: [90, 70, "*", 150], body: [[th(rs("table")), th(rs("article")), th(rs("title")), th(rs("status"))], ...tables.map((t) => [td(t.table), td(t.article), td(t.title), { text: t.detail.replace(`${t.table}: `, ""), color: t.status === "por_verificar" ? "#c62828" : undefined }])] }, layout: GRID, fontSize: 7.5, margin: [0, 0, 0, 8] }
      : { text: "—" },
    { text: `9. ${rs("secSignatures")}`, style: "h2", headlineLevel: 1 },
    {
      unbreakable: true,
      columns: [
        { stack: [{ text: "\n\n\n_______________________________" }, { text: rs("author"), bold: true }, { text: m.author || " " }], alignment: "center" },
        { stack: [{ text: "\n\n\n_______________________________" }, { text: rs("reviewed"), bold: true }, { text: " " }], alignment: "center" },
      ],
      margin: [0, 6, 0, 10],
    },
    { text: rs("disclaimer"), style: "refs", alignment: "center" },
  ];

  return {
    info: { title: `${rs("memoriaTitle")} — ${m.name}`, author: m.author || undefined, subject: input.norm.label, creator: "REA Eléctrico" },
    pageSize: "LETTER",
    pageMargins: [40, 50, 40, 46],
    // Un título no se queda solo al pie de la hoja: pasa a la siguiente con su contenido.
    pageBreakBefore: (node, q) => node.headlineLevel === 1 && q.getFollowingNodesOnPage().length === 0,
    watermark: draft ? { text: rs("draft"), color: "#c62828", opacity: 0.07, bold: true } : undefined,
    header: (_page: number) => ({
      columns: [
        { text: m.name, bold: true },
        { text: `${rs("memoriaTitle")} · ${input.norm.label}`, alignment: "right" },
      ],
      margin: [40, 22, 40, 0],
      fontSize: 8,
      color: "#555",
    }),
    footer: (page: number, total: number) => ({
      columns: [
        { text: `${rs("generated")}: ${fmtDate(date)}`, fontSize: 7, color: "#777" },
        { text: rs("page", { n: page, total }), alignment: "right", fontSize: 8 },
      ],
      margin: [40, 14, 40, 0],
    }),
    content: [
      { section: intro },
      { section: diagram, pageOrientation: tall ? "portrait" : "landscape" },
      { section: circuitTable, pageOrientation: "landscape" },
      { section: schedules, pageOrientation: "landscape" },
      { section: [...memoria, ...closing], pageOrientation: "portrait" },
    ],
    defaultStyle: { font: "Roboto", fontSize: 8.5, lineHeight: 1.15 },
    styles: {
      title: { fontSize: 22, bold: true, color: "#1d3f73", margin: [0, 40, 0, 6] },
      subtitle: { fontSize: 15, bold: true, margin: [0, 0, 0, 4] },
      h2: { fontSize: 12, bold: true, color: "#1d3f73", margin: [0, 8, 0, 5] },
      h3: { fontSize: 10, bold: true, margin: [0, 8, 0, 3] },
      th: { bold: true, fontSize: 7.5 },
      refs: { fontSize: 7, color: "#666", italics: true },
    },
  };
}
