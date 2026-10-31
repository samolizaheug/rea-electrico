import { createDefaultRegistry, moveElement, setConnectionSection, type Project } from "@rea/core";
import { runSizing } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { busGeometry, mccSectionAt, nodeGeometry, syncMccSections, wireEnds } from "@rea/symbols";
import { describe, expect, it } from "vitest";
import { sistemaEjemplo } from "../src";

const registry = createDefaultRegistry();
const ccm = (p: Project) => p.elements.find((e) => e.tag === "CCM-1")!;
const byTag = (p: Project, tag: string) => p.elements.find((e) => e.tag === tag)!;
const run = (p: Project) => runSizing(p, registry, nom001Sede2012);

describe("barras del CCM (secciones, bus vertical y horizontal)", () => {
  it("la sección de cada interruptor sale de dónde está dibujado bajo el CCM", () => {
    const p = sistemaEjemplo();
    expect(["INT-11", "INT-12", "INT-13"].map((t) => byTag(p, t).params.mccSection)).toEqual([1, 2, 3]);
    // Mover INT-13 bajo la primera sección la cambia de sección.
    const int13 = byTag(p, "INT-13");
    const moved = syncMccSections(moveElement(p, int13.id, 110, p.diagram.nodes[int13.id]!.y), registry);
    expect(byTag(moved, "INT-13").params.mccSection).toBe(1);
    // El símbolo se dibuja por secciones (3 buses verticales con su etiqueta).
    const g = nodeGeometry(p, registry, ccm(p).id)!;
    expect(g.symbol.shapes.filter((s) => s.k === "text" && /^S\d$/.test(s.text)).length).toBe(3);
    expect(mccSectionAt(p, registry, ccm(p).id, p.diagram.nodes[ccm(p).id]!.x + 5)).toBe(1);
  });

  it("la sección elegida al conectar manda sobre la posición y el cable sale de esa barra", () => {
    const p = sistemaEjemplo();
    const int13 = byTag(p, "INT-13");
    const conn = p.connections.find((c) => [c.a.elementId, c.b.elementId].includes(int13.id) && [c.a.elementId, c.b.elementId].includes(ccm(p).id))!;
    const q = syncMccSections(setConnectionSection(p, conn.id, 1), registry);
    expect(byTag(q, "INT-13").params.mccSection).toBe(1);
    // El extremo del cable en el CCM cae en la barra de la sección 1.
    const ends = wireEnds(q, registry, q.connections.find((c) => c.id === conn.id)!);
    const end = conn.a.elementId === ccm(q).id ? ends.a : ends.b;
    const seg1 = busGeometry(q, registry, ccm(q).id)!.segments![0]!;
    expect(end.x).toBeGreaterThanOrEqual(seg1[0]);
    expect(end.x).toBeLessThanOrEqual(seg1[1]);
    // Mover INT-13 ya no cambia su sección (la eligió el usuario).
    const moved = syncMccSections(moveElement(q, int13.id, 480, q.diagram.nodes[int13.id]!.y), registry);
    expect(byTag(moved, "INT-13").params.mccSection).toBe(1);
    // El símbolo tiene un punto de conexión por sección (más la acometida).
    expect(nodeGeometry(q, registry, ccm(q).id)!.anchors.bus!.length).toBe(1 + 3);
  });

  it("carga por sección y total con 430-24 (cálculo a mano)", () => {
    const p = sistemaEjemplo();
    const r = run(p);
    const c = r.mcc!.get(ccm(p).id)!;
    // S1: M-01 (65 A) → 1.25 · 65 = 81.25 A. S2: VFD-01 (31.36 A, 430-122) → 1.25 · 31.36 = 39.2 A.
    // S3: M-03 (14 A) → 1.25 · 14 = 17.5 A. Total = 1.25 · 65 + 31.36 + 14 = 126.61 A (igual que AL-1).
    expect(c.sections.map((s) => [s.section, s.circuits])).toEqual([
      [1, ["INT-11"]],
      [2, ["INT-12"]],
      [3, ["INT-13"]],
    ]);
    expect(c.sections[0]!.designA).toBeCloseTo(81.25, 2);
    expect(c.sections[1]!.designA).toBeCloseTo(39.2, 2);
    expect(c.sections[2]!.designA).toBeCloseTo(17.5, 2);
    expect(c.total.designA).toBeCloseTo(126.61, 1);
    expect(c.feederProtectionA).toBe(200);
    expect(r.issues.filter((i) => i.code.startsWith("ccm"))).toEqual([]);
  });

  it("advierte si una sección excede su bus vertical o el total excede el horizontal", () => {
    const p = sistemaEjemplo();
    Object.assign(ccm(p).params, { verticalBusA: 80, horizontalBusA: 120 });
    const codes = run(p).issues.filter((i) => i.code.startsWith("ccm")).map((i) => `${i.code}:${i.severity}`);
    expect(codes).toContain("ccm-bus-vertical:warning"); // S1: 81.25 A > 80 A
    expect(codes).toContain("ccm-bus-horizontal:warning"); // total 126.61 A > 120 A
    expect(codes).toContain("ccm-430-94:error"); // INT-1 de 200 A > 120 A
  });

  it("bus vertical distinto por sección, sección faltante y capacidad anterior «busRatingA»", () => {
    const p = sistemaEjemplo();
    Object.assign(ccm(p).params, { verticalBusBySection: "300, 300, 15" });
    let issues = run(p).issues.filter((i) => i.code.startsWith("ccm"));
    expect(issues.map((i) => i.message)).toEqual([expect.stringMatching(/^CCM-1 sección 3: .*excede el bus vertical de 15 A/)]);

    byTag(p, "INT-13").params.mccSection = null;
    issues = run(p).issues.filter((i) => i.code.startsWith("ccm"));
    expect(issues.some((i) => /indique la «Sección del CCM» en INT-13/.test(i.message))).toBe(true);

    const q = sistemaEjemplo();
    Object.assign(ccm(q).params, { horizontalBusA: null, busRatingA: 150 });
    expect(run(q).mcc!.get(ccm(q).id)!.total.ratingA).toBe(150);
  });
});
