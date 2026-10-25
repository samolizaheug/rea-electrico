import { voltageText } from "@rea/core";
import ExcelJS from "exceljs";
import { circuitRows, elementReports, fmtDate, isDraft, normTables, type ReportInput } from "./data";
import { rs } from "./strings";
import { toDisplayLength } from "./units";

/**
 * Libro de Excel con la cédula de circuitos, un cuadro de carga por hoja, la memoria paso a
 * paso y las observaciones. Los valores numéricos se guardan como números (no texto), para
 * que el usuario pueda rehacer o extender los cálculos en la hoja.
 */

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF3" } };
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF9AA3AD" } },
  bottom: { style: "thin", color: { argb: "FF9AA3AD" } },
  left: { style: "thin", color: { argb: "FF9AA3AD" } },
  right: { style: "thin", color: { argb: "FF9AA3AD" } },
};

interface Col {
  header: string;
  width: number;
  numFmt?: string;
}

/** Nombre de hoja válido en Excel: máx. 31 caracteres, sin []:*?/\ y único. */
function sheetName(wb: ExcelJS.Workbook, name: string): string {
  const base = name.replace(/[[\]:*?/\\]/g, "-").slice(0, 31);
  let n = base;
  for (let i = 2; wb.getWorksheet(n); i++) n = `${base.slice(0, 28)} ${i}`;
  return n;
}

function table(ws: ExcelJS.Worksheet, startRow: number, cols: Col[], rows: (string | number | null | undefined)[][]): number {
  const header = ws.getRow(startRow);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = THIN;
    cell.alignment = { vertical: "middle", wrapText: true };
    const col = ws.getColumn(i + 1);
    col.width = Math.max(col.width ?? 0, c.width);
  });
  rows.forEach((r, ri) => {
    const row = ws.getRow(startRow + 1 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v === undefined || (typeof v === "number" && !Number.isFinite(v)) ? null : v;
      cell.border = THIN;
      cell.alignment = { vertical: "top", wrapText: typeof v === "string" && v.length > 30 };
      const f = cols[ci]?.numFmt;
      if (f && typeof v === "number") cell.numFmt = f;
    });
  });
  return startRow + 1 + rows.length;
}

export async function buildWorkbook(input: ReportInput): Promise<ExcelJS.Workbook> {
  const { project } = input;
  const m = project.meta;
  const s = project.settings;
  const date = input.date ?? new Date();
  const u = s.units;
  const len = (m: number | undefined) => (m === undefined ? undefined : toDisplayLength(m, u));
  const wb = new ExcelJS.Workbook();
  wb.creator = m.author || "REA Eléctrico";
  wb.title = `${rs("memoriaTitle")} — ${m.name}`;
  wb.created = date;

  // ---- Proyecto y criterios.
  const wsP = wb.addWorksheet(rs("sheetProject"));
  wsP.getColumn(1).width = 34;
  wsP.getColumn(2).width = 70;
  const kv: [string, string | number][] = [
    [rs("name"), m.name],
    [rs("client"), m.client],
    [rs("location"), m.location],
    [rs("author"), m.author],
    [rs("description"), m.description],
    [rs("generated"), fmtDate(date)],
    [rs("norm"), input.norm.label],
    [rs("method"), (input.norm.methodNote ?? rs("methodValue"))],
    [`${rs("frequency")} (Hz)`, s.frequencyHz],
    [`${rs("ambientAir")} (°C)`, s.ambient.airC],
    [`${rs("ambientGround")} (°C)`, s.ambient.groundC],
    [`${rs("vdBranch")} (%)`, s.voltageDrop.branchPct],
    [`${rs("vdFeeder")} (%)`, s.voltageDrop.feederPct],
    [`${rs("vdTotal")} (%)`, s.voltageDrop.totalPct],
    [`${rs("unbalance")} (%)`, s.phaseUnbalance.maxPct],
  ];
  wsP.getCell("A1").value = rs("memoriaTitle");
  wsP.getCell("A1").font = { bold: true, size: 14 };
  if (isDraft(input)) {
    wsP.getCell("B1").value = `${rs("draft")}: ${rs("draftReason")}`;
    wsP.getCell("B1").font = { bold: true, color: { argb: "FFC62828" } };
  }
  kv.forEach(([k, v], i) => {
    const r = wsP.getRow(3 + i);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = v;
    r.getCell(2).alignment = { wrapText: true, horizontal: "left" };
  });
  const tables = normTables(input.norm);
  let row = 4 + kv.length;
  wsP.getCell(`A${row}`).value = rs("secTables");
  wsP.getCell(`A${row}`).font = { bold: true, size: 12 };
  table(
    wsP,
    row + 1,
    [
      { header: rs("table"), width: 34 },
      { header: rs("status"), width: 70 },
    ],
    tables.map((t) => [`${t.table} — ${t.title} (p. ${t.pages.join(", ")})`, `${t.detail}${t.necEquivalent ? ` · ${t.necEquivalent} (informativo)` : ""}`]),
  );
  row += 2 + tables.length;
  wsP.getCell(`A${row + 1}`).value = rs("disclaimer");
  wsP.getCell(`A${row + 1}`).font = { italic: true, color: { argb: "FF666666" } };

  // ---- Cédula de circuitos.
  const wsC = wb.addWorksheet(rs("sheetCircuits"), { views: [{ state: "frozen", ySplit: 1 }] });
  table(
    wsC,
    1,
    [
      { header: rs("circuit"), width: 10 },
      { header: rs("protection").replace(" (A)", ""), width: 10 },
      { header: rs("from"), width: 10 },
      { header: rs("to"), width: 22 },
      { header: rs("kind"), width: 12 },
      { header: rs("loadA"), width: 11, numFmt: "0.00" },
      { header: rs("designA"), width: 11, numFmt: "0.00" },
      { header: "Regla", width: 30 },
      { header: rs("protection"), width: 12, numFmt: "0" },
      { header: rs("conductor"), width: 18 },
      { header: rs("egc"), width: 10 },
      { header: rs("ampacity"), width: 12, numFmt: "0.0" },
      { header: rs("length", { unit: u.length }), width: 8, numFmt: "0.0" },
      { header: rs("dropPct"), width: 11, numFmt: "0.000" },
      { header: rs("cumulativePct"), width: 11, numFmt: "0.000" },
      { header: rs("governing"), width: 16 },
    ],
    circuitRows(input).map((c) => [c.tag, c.breakerTag ?? "—", c.from, c.to, c.kind, c.loadA, c.designA, c.rule, c.protectionA, c.conductor, c.egc ?? "—", c.ampacityA, len(c.lengthM), c.dropPct, c.cumulativePct, c.governing]),
  );

  // ---- Cuadros de carga: una hoja por tablero; los totales son fórmulas de Excel.
  for (const sch of input.schedules) {
    const ws = wb.addWorksheet(sheetName(wb, rs("sheetSchedule", { tag: sch.tag })), { views: [{ state: "frozen", ySplit: 3 }] });
    ws.getCell("A1").value = `${sch.tag} — ${voltageText(sch.vNomLL, sch.system)} · ${sch.system ?? ""}`;
    ws.getCell("A1").font = { bold: true, size: 12 };
    const first = 4;
    const last = table(
      ws,
      3,
      [
        { header: rs("circuit"), width: 10 },
        { header: rs("fedBy"), width: 26 },
        { header: rs("phases"), width: 7 },
        { header: "A (VA)", width: 11, numFmt: "#,##0" },
        { header: "B (VA)", width: 11, numFmt: "#,##0" },
        { header: "C (VA)", width: 11, numFmt: "#,##0" },
        { header: `${rs("total")} (VA)`, width: 12, numFmt: "#,##0" },
        { header: "P (kW)", width: 9, numFmt: "0.000" },
        { header: "Q (kvar)", width: 9, numFmt: "0.000" },
        { header: "I (A)", width: 9, numFmt: "0.00" },
        { header: rs("protection"), width: 12, numFmt: "0" },
        { header: rs("conductor"), width: 18 },
        { header: rs("length", { unit: u.length }), width: 8, numFmt: "0.0" },
        { header: rs("dropPct"), width: 11, numFmt: "0.000" },
      ],
      sch.rows.map((r) => [r.circuit, r.description, r.phases, r.va.a, r.va.b, r.va.c, r.totalVA, r.pKW, r.qKvar, r.currentA, r.protectionA, r.conductor ?? "—", len(r.lengthM), r.dropPct]),
    ) - 1;
    const tot = ws.getRow(last + 1);
    tot.getCell(1).value = rs("totals");
    tot.font = { bold: true };
    const vln = sch.vNomLL / Math.sqrt(3);
    for (const [i, col] of ["D", "E", "F", "G", "H", "I"].entries()) {
      const cell = tot.getCell(4 + i);
      const result = i < 3 ? [sch.totals.va.a, sch.totals.va.b, sch.totals.va.c][i] : i === 3 ? sch.totals.totalVA : i === 4 ? sch.totals.pKW : sch.totals.qKvar;
      cell.value = { formula: `SUM(${col}${first}:${col}${last})`, result };
      cell.numFmt = i < 4 ? "#,##0" : "0.000";
      cell.border = THIN;
    }
    const cur = ws.getRow(last + 2);
    cur.getCell(1).value = rs("phaseCurrent");
    cur.font = { bold: true };
    ["D", "E", "F"].forEach((col, i) => {
      const cell = cur.getCell(4 + i);
      cell.value = { formula: `${col}${last + 1}/(${sch.vNomLL}/SQRT(3))`, result: [sch.totals.va.a, sch.totals.va.b, sch.totals.va.c][i]! / vln };
      cell.numFmt = "0.00";
      cell.border = THIN;
    });
    const unb = ws.getRow(last + 3);
    unb.getCell(1).value = `${rs("unbalanceShort")} (%)`;
    unb.font = { bold: true };
    const ub = unb.getCell(4);
    const rng = `D${last + 1}:F${last + 1}`;
    ub.value = { formula: `IF(MAX(${rng})=0,0,(MAX(${rng})-MIN(${rng}))/MAX(${rng})*100)`, result: sch.totals.unbalancePct };
    ub.numFmt = "0.00";
    ub.border = THIN;
    if (sch.totals.unbalanceLimitPct !== undefined) {
      unb.getCell(5).value = `${rs("limit")} ${sch.totals.unbalanceLimitPct} %`;
      if (sch.totals.unbalanceExceeded) ub.font = { bold: true, color: { argb: "FFB26B00" } };
    }
    sch.notes.forEach((n, i) => {
      const c = ws.getCell(`A${last + 5 + i}`);
      c.value = n;
      c.font = { italic: true, color: { argb: "FF666666" } };
    });
  }

  // ---- Memoria paso a paso.
  const wsM = wb.addWorksheet(rs("sheetMemoria"), { views: [{ state: "frozen", ySplit: 1 }] });
  const memRows: (string | number)[][] = [];
  for (const e of elementReports(input)) {
    for (const tr of e.traces) {
      tr.steps.forEach((st, i) => memRows.push([e.tag, e.typeName, tr.title, i + 1, st.label, st.formula ?? "", st.substitution ?? "", st.result, st.refs?.join(" · ") ?? ""]));
    }
  }
  table(
    wsM,
    1,
    [
      { header: rs("element"), width: 10 },
      { header: rs("kind"), width: 16 },
      { header: rs("memoriaTitle"), width: 22 },
      { header: rs("step"), width: 6 },
      { header: rs("description"), width: 34 },
      { header: rs("formula"), width: 34 },
      { header: rs("substitution"), width: 40 },
      { header: rs("result"), width: 22 },
      { header: rs("refs"), width: 40 },
    ],
    memRows,
  );
  wsM.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };

  // ---- Observaciones.
  const wsI = wb.addWorksheet(rs("sheetIssues"));
  const sev = { error: rs("error"), warning: rs("warning"), info: rs("info") } as const;
  table(
    wsI,
    1,
    [
      { header: rs("severity"), width: 14 },
      { header: rs("message"), width: 110 },
    ],
    input.issues.length ? input.issues.map((i) => [sev[i.severity], i.message]) : [["—", rs("noIssues")]],
  );

  return wb;
}
