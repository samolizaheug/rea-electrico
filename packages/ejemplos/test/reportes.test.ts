import ExcelJS from "exceljs";
import { createDefaultRegistry } from "@rea/core";
import { panelSchedules, runSizing, scheduleIssues } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { buildWorkbook, circuitRows, diagramSvg, elementReports, isDraft, memoriaDocDefinition, setReportLanguage, sizeText, svgAspect, toDisplayLength, type ReportInput } from "@rea/reports";
import { renderPdf } from "@rea/reports/src/node";
import { describe, expect, it } from "vitest";
import { sistemaEjemplo } from "../src";

const registry = createDefaultRegistry();
const project = sistemaEjemplo();
const sizing = runSizing(project, registry, nom001Sede2012);
const schedules = panelSchedules(project, registry, sizing.loadFlow, sizing);
const input: ReportInput = { project, registry, norm: nom001Sede2012, sizing, schedules, issues: [...sizing.issues, ...scheduleIssues(schedules)], date: new Date("2026-10-24T12:00:00") };

describe("reportes del sistema de ejemplo", () => {
  it("unifilar SVG: un grupo por elemento, todas las etiquetas, sin valores no numéricos", () => {
    const svg = diagramSvg(project, registry, { results: sizing, norm: nom001Sede2012 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    for (const el of project.elements) expect(svg).toContain(`>${el.tag}<`);
    // Resultados junto al símbolo y cajetín.
    // El cable muestra solo su configuración (ya trae el calibre); los tableros de 4 hilos, V L-L / V L-N.
    expect(svg).toContain("3x#2/0AWG(Ph)");
    expect(svg).not.toContain("2/0 AWG (");
    expect(svg).toMatch(/216\.\d\/124\.\d V/);
    // Cargas: capacidad · fases - tensión · corriente (FLA en motores); alumbrado y contactos en W.
    for (const s of ["50 HP", "3Ph - 460 V", "65.00 A (FLA)", "1000 W", "1Ph - 127 V", "15 kW", "40 kVA"]) expect(svg).toContain(s);
    // Interruptores: polos · marco/ajuste · capacidad interruptiva.
    for (const s of ["3P", "1P", "200/200A", "25 kA", "10 kA"]) expect(svg).toContain(s);
    expect(input.sizing.issues.filter((i) => i.code === "polos-interruptor" || i.code === "marco-interruptor")).toEqual([]);
    expect(svg).toContain("NOM-001-SEDE-2012");
    // Proporción alto/ancho leída del SVG (1 sería el valor por omisión si faltara width/height).
    expect(svgAspect(svg)).not.toBe(1);
    expect(svgAspect(svg)).toBeGreaterThan(0.5);
    expect(svgAspect(svg)).toBeLessThan(2);
  });

  it("cédula de circuitos: un renglón por cable, con origen y destino", () => {
    const rows = circuitRows(input);
    expect(rows).toHaveLength(sizing.circuits.size);
    const by = (tag: string) => rows.find((r) => r.tag === tag)!;
    // Configuración del cable: CCM-1 es de 3 hilos (sin neutro).
    expect(by("AL-1")).toMatchObject({ from: "TG", to: "CCM-1", protectionA: 200, conductor: "3x#2/0AWG(Ph)+1x#4AWG(Gnd)", breakerTag: "INT-1" });
    // TAB-A es 3F4H: lleva neutro del calibre de fase; el puente de unión del secundario sale de la Tabla 250-66.
    expect(by("AL-3").conductor).toBe("3x250kcmil(Ph)+1x250kcmil(N)+1x#2AWG(Gnd)");
    expect(by("AL-3")).toMatchObject({ from: "TR-2", to: "TAB-A" });
    expect(by("AL-21")).toMatchObject({ from: "TAB-A", to: "L-01" });
    expect(by("AL-12").to).toBe("VFD-01");
  });

  it("unidades: con calibres en AWG no se agrega el área; equivalencias AWG de secciones IEC", () => {
    const awg = { conductorSize: "AWG" as const, length: "m" as const };
    expect(sizeText("2/0", "AWG", 67.43, awg)).toBe("2/0 AWG");
    // 25 mm² está más cerca de 3 AWG (26.7 mm²) que de 4 AWG (21.2 mm²).
    expect(sizeText("25", "mm2", 25, awg)).toBe("25 mm² (≈ 3 AWG)");
    expect(sizeText("120", "mm2", 120, awg)).toBe("120 mm² (≈ 250 kcmil)");
    expect(toDisplayLength(30.48, { conductorSize: "mm2", length: "ft" })).toBeCloseTo(100, 9);
  });

  it("reportes en inglés: textos fijos traducidos", async () => {
    setReportLanguage("en");
    try {
      const def = memoriaDocDefinition(input);
      expect(JSON.stringify(def.content)).toContain("Conductor and protection schedule");
    } finally {
      setReportLanguage("es");
    }
  });

  it("memoria por elemento: de la fuente hacia las cargas, con trazas", () => {
    const els = elementReports(input);
    expect(els[0]!.tag).toBe("ACOM-1");
    const al21 = els.find((e) => e.tag === "AL-21")!;
    expect(al21.traces.length).toBeGreaterThanOrEqual(2);
    expect(al21.traces[0]!.steps.some((s) => s.refs?.some((r) => r.includes("310-15")))).toBe(true);
  });

  it("no es borrador: tablas verificadas y sin errores", () => {
    expect(isDraft(input)).toBe(false);
    expect(isDraft({ ...input, issues: [{ severity: "error", message: "x" }] })).toBe(true);
  });

  it("memoria en PDF", async () => {
    const pdf = await renderPdf(memoriaDocDefinition(input));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pages).toBeGreaterThan(10);
  }, 60_000);

  it("Excel: hojas, cédula y cuadros con fórmulas que reproducen los totales", async () => {
    const wb = await buildWorkbook(input);
    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    expect(back.worksheets.map((w) => w.name)).toEqual(["Proyecto", "Circuitos", "Cuadro TG", "Cuadro CCM-1", "Cuadro TAB-B", "Cuadro TAB-A", "Memoria", "Observaciones"]);
    expect(back.getWorksheet("Circuitos")!.actualRowCount).toBe(1 + sizing.circuits.size);
    const ws = back.getWorksheet("Cuadro TAB-A")!;
    // Encabezado en la fila 3; tres circuitos (4–6); totales en 7; corriente en 8; desbalance en 9.
    const tot = ws.getCell("D7").value as { formula: string; result: number };
    expect(tot.formula).toBe("SUM(D4:D6)");
    expect(tot.result).toBeCloseTo(6666.667, 2);
    const unb = ws.getCell("D9").value as { formula: string; result: number };
    expect(unb.formula).toContain("MAX(D7:F7)");
    expect(unb.result).toBeCloseTo(20.58, 2);
    expect(typeof ws.getCell("D4").value).toBe("number");
  });
});
