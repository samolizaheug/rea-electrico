import { createDefaultRegistry, updateSettings } from "@rea/core";
import { panelSchedules, runSizing, scheduleIssues } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { describe, expect, it } from "vitest";
import { sistemaEjemplo } from "../src";

const registry = createDefaultRegistry();
const project = sistemaEjemplo();
const sizing = runSizing(project, registry, nom001Sede2012);
const schedules = panelSchedules(project, registry, sizing.loadFlow, sizing);
const board = (tag: string) => schedules.find((s) => s.tag === tag)!;

describe("cuadros de carga del sistema de ejemplo", () => {
  it("un cuadro por tablero, CCM y barra", () => {
    expect(schedules.map((s) => s.tag)).toEqual(["TG", "CCM-1", "TAB-B", "TAB-A"]);
  });

  it("TAB-A: reparto por fase, corriente por fase y desbalance (cálculo a mano)", () => {
    // L-01 1 111.1 VA en A; C-01 1 440 VA en B; CG-01 16 666.7 VA trifásica → 5 555.6 por fase.
    const t = board("TAB-A");
    expect(t.rows.map((r) => [r.circuit, r.description, r.phases])).toEqual([
      ["INT-21", "L-01", "A"],
      ["INT-22", "C-01", "B"],
      ["INT-23", "CG-01", "ABC"],
    ]);
    expect(t.totals.va.a).toBeCloseTo(1111.111 + 5555.556, 2);
    expect(t.totals.va.b).toBeCloseTo(1440 + 5555.556, 2);
    expect(t.totals.va.c).toBeCloseTo(5555.556, 2);
    // I_A = 6 666.7 / 127.017 = 52.49 A; desbalance = (6 995.6 − 5 555.6) / 6 995.6 = 20.58 %.
    expect(t.totals.currentA.a).toBeCloseTo(6666.667 / (220 / Math.sqrt(3)), 3);
    expect(t.totals.unbalancePct).toBeCloseTo(((6995.556 - 5555.556) / 6995.556) * 100, 3);
  });

  it("renglones con protección, conductor (fase + tierra), longitud y caída", () => {
    const r = board("TAB-A").rows[0]!;
    expect(r).toMatchObject({ protectionA: 15, conductor: "12 + 12 T", lengthM: 30, poles: 3 });
    expect(r.dropPct).toBeCloseTo(2.4864, 3);
  });

  it("TG: el alimentador de TAB-B suma sus cargas con su propio reparto; TR-2 equilibrado", () => {
    const tg = board("TG");
    const tabB = tg.rows.find((r) => r.description.includes("TAB-B"))!;
    // L-02 3 333.3 VA en A + CA-01 40 000 VA trifásica.
    expect(tabB.va.a).toBeCloseTo(3333.333 + 13333.333, 2);
    expect(tabB.va.b).toBeCloseTo(13333.333, 2);
    const tr2 = tg.rows.find((r) => r.description.includes("TR-2"))!;
    expect(tr2.va.a).toBeCloseTo(tr2.va.b, 6);
    expect(tg.notes.join(" ")).toContain("equilibrados");
  });

  it("límite de desbalance del proyecto (5 % por defecto): advertencia solo donde se rebasa", () => {
    const t = board("TAB-A");
    expect(t.totals).toMatchObject({ unbalanceLimitPct: 5, unbalanceExceeded: true });
    const issues = scheduleIssues(schedules);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
    expect(issues.map((i) => i.elementIds[0])).toContain(t.boardId);
    expect(issues.length).toBe(schedules.filter((s) => s.totals.unbalancePct > 5).length);
    // Con un límite de 25 % el TAB-A ya no se marca.
    const relaxed = updateSettings(project, { phaseUnbalance: { maxPct: 25 } });
    const s2 = panelSchedules(relaxed, registry, sizing.loadFlow, sizing);
    expect(s2.find((s) => s.tag === "TAB-A")!.totals.unbalanceExceeded).toBe(false);
  });
});
