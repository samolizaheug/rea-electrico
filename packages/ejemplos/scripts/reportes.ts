/**
 * Genera los reportes del sistema de ejemplo en examples/reportes/:
 * unifilar (SVG, PNG, PDF), memoria de cálculo (PDF) y libro de Excel.
 * Uso: pnpm --filter @rea/ejemplos reportes
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDefaultRegistry } from "@rea/core";
import { DEFAULT_EQUIPMENT_VOLTAGE, panelSchedules, runSizing, scheduleIssues, validateTopology } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { buildWorkbook, diagramPdfDocDefinition, diagramSvg, isDraft, issueSeverityByElement, memoriaDocDefinition, type ReportInput } from "@rea/reports";
import { renderPdf } from "@rea/reports/src/node";
import { Resvg } from "@resvg/resvg-js";
import { sistemaEjemplo } from "../src";

const dir = fileURLToPath(new URL("../../../examples/reportes/", import.meta.url));
mkdirSync(dir, { recursive: true });

const registry = createDefaultRegistry();
const project = sistemaEjemplo();
const norm = nom001Sede2012;
const sizing = runSizing(project, registry, norm);
const schedules = panelSchedules(project, registry, sizing.loadFlow, sizing);
const issues = [...validateTopology(project, registry, DEFAULT_EQUIPMENT_VOLTAGE).issues, ...sizing.issues, ...scheduleIssues(schedules)];
// Fecha fija para que los archivos del ejemplo sean reproducibles.
const input: ReportInput = { project, registry, norm, sizing, schedules, issues, date: new Date("2026-10-24T12:00:00") };

const svg = diagramSvg(project, registry, { results: sizing, issues: issueSeverityByElement(issues), norm, draft: isDraft(input), date: input.date });
writeFileSync(`${dir}unifilar.svg`, svg, "utf8");
const png = new Resvg(svg, { fitTo: { mode: "zoom", value: 2 }, font: { loadSystemFonts: true, defaultFontFamily: "Arial" } }).render().asPng();
writeFileSync(`${dir}unifilar.png`, png);
writeFileSync(`${dir}unifilar.pdf`, await renderPdf(diagramPdfDocDefinition(svg, `Unifilar — ${project.meta.name}`)));
writeFileSync(`${dir}memoria.pdf`, await renderPdf(memoriaDocDefinition(input)));
const wb = await buildWorkbook(input);
writeFileSync(`${dir}memoria.xlsx`, Buffer.from(await wb.xlsx.writeBuffer()));
console.log(`Reportes escritos en ${dir}`);
