import { createDefaultRegistry, type Project } from "@rea/core";
import { runSizing } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { describe, expect, it } from "vitest";
import { sistemaEjemplo } from "../src";

const registry = createDefaultRegistry();
const ccm = (p: Project) => p.elements.find((e) => e.tag === "CCM-1")!;
const run = (p: Project) => runSizing(p, registry, nom001Sede2012);

describe("barras del CCM (secciones, bus vertical y horizontal)", () => {
  it("carga por sección y total con 430-24 (cálculo a mano)", () => {
    const p = sistemaEjemplo();
    const r = run(p);
    const c = r.mcc!.get(ccm(p).id)!;
    // Sección 1: M-01 (65 A) y VFD-01 (31.36 A) → 1.25 · 65 + 31.36 = 112.61 A.
    // Sección 2: M-03 (14 A) → 1.25 · 14 = 17.5 A. Total = 126.61 A (igual que el alimentador AL-1).
    expect(c.sections.map((s) => [s.section, s.circuits])).toEqual([
      [1, ["INT-11", "INT-12"]],
      [2, ["INT-13"]],
    ]);
    expect(c.sections[0]!.designA).toBeCloseTo(112.61, 1);
    expect(c.sections[1]!.designA).toBeCloseTo(17.5, 2);
    expect(c.total.designA).toBeCloseTo(126.61, 1);
    expect(c.feederProtectionA).toBe(200);
    expect(r.issues.filter((i) => i.code.startsWith("ccm"))).toEqual([]);
  });

  it("advierte si una sección excede su bus vertical o el total excede el horizontal", () => {
    const p = sistemaEjemplo();
    Object.assign(ccm(p).params, { verticalBusA: 100, horizontalBusA: 120 });
    const codes = run(p).issues.filter((i) => i.code.startsWith("ccm")).map((i) => `${i.code}:${i.severity}`);
    expect(codes).toContain("ccm-bus-vertical:warning"); // sección 1: 112.61 A > 100 A
    expect(codes).toContain("ccm-bus-horizontal:warning"); // total 126.61 A > 120 A
    expect(codes).toContain("ccm-430-94:error"); // INT-1 de 200 A > 120 A
  });

  it("bus vertical distinto por sección, sección faltante y sección inexistente", () => {
    const p = sistemaEjemplo();
    Object.assign(ccm(p).params, { verticalBusBySection: "300, 15" });
    let issues = run(p).issues.filter((i) => i.code.startsWith("ccm"));
    expect(issues.map((i) => i.message)).toEqual([expect.stringMatching(/^CCM-1 sección 2: .*excede el bus vertical de 15 A/)]);

    p.elements.find((e) => e.tag === "INT-13")!.params.mccSection = null;
    issues = run(p).issues.filter((i) => i.code.startsWith("ccm"));
    expect(issues.some((i) => /indique la «Sección del CCM» en INT-13/.test(i.message))).toBe(true);

    p.elements.find((e) => e.tag === "INT-13")!.params.mccSection = 5;
    issues = run(p).issues.filter((i) => i.code.startsWith("ccm"));
    expect(issues.some((i) => i.severity === "error" && /sección 5, pero CCM-1 tiene 2/.test(i.message))).toBe(true);
  });
});
