import { addElement, connect, createDefaultRegistry, createProject, setConnectionSection, type ParamValue, type Project } from "@rea/core";
import { busGeometry, nodeGeometry, syncMccSections } from "@rea/symbols";
import { describe, expect, it } from "vitest";
import { distributeBus } from "../src/editor/distribute";

const registry = createDefaultRegistry();

function build(busType: "mcc" | "panelboard", motors: { tag: string; x: number; section?: number }[], params: Record<string, ParamValue> = {}) {
  let p: Project = createProject({ name: "dist" });
  const ids: Record<string, string> = {};
  const add = (tag: string, type: string, x: number, y: number, pr: Record<string, ParamValue> = {}) => {
    const r = addElement(p, registry, type, { tag, position: { x, y }, params: pr });
    p = r.project;
    ids[tag] = r.elementId;
  };
  add("B", busType, 100, 100, { voltageV: 480, system: "3F3H", ...params });
  for (const m of motors) {
    add(m.tag, "motor", m.x, 300, { ratedPower: 15, ratedPowerUnit: "hp", voltageV: 480, system: "3F3H" });
    const r = connect(p, registry, { elementId: ids.B!, portId: "bus" }, { elementId: ids[m.tag]!, portId: "in" });
    p = m.section ? setConnectionSection(r.project, r.connectionId, m.section) : r.project;
  }
  return { p: syncMccSections(p, registry), ids };
}

/** Extensión de cada motor con su etiqueta debajo (tag + 3 renglones como en el diagrama). */
const LINES = ["15 HP", "3Ph - 480 V", "21.00 A (FLA)"];
const span = (p: Project, id: string) => {
  const n = p.diagram.nodes[id]!;
  const g = nodeGeometry(p, registry, id)!;
  const cx = n.x + g.width / 2;
  const w = Math.max(...LINES.map((l) => l.length * 6.2)) + 4;
  return [Math.min(n.x, cx - w / 2), Math.max(n.x + g.width, cx + w / 2)] as const;
};

describe("distribuir cargas de una barra", () => {
  it("CCM: los motores de cada sección quedan separados y dentro de su sección", () => {
    const motors = [
      { tag: "M-01", x: 120, section: 1 },
      { tag: "M-02", x: 130, section: 1 },
      { tag: "M-03", x: 140, section: 2 },
      { tag: "M-04", x: 150, section: 2 },
      { tag: "M-05", x: 160, section: 2 },
    ];
    const { p, ids } = build("mcc", motors, { sections: 2 });
    const q = distributeBus(p, registry, ids.B!, (id) => (id === ids.B ? [] : LINES));
    // Sin traslapes entre motores vecinos.
    const spans = motors.map((m) => span(q, ids[m.tag]!)).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]);
    // Cada motor sigue debajo de la barra de su sección.
    const segs = busGeometry(q, registry, ids.B!)!.segments!;
    for (const m of motors) {
      const n = q.diagram.nodes[ids[m.tag]!]!;
      const cx = n.x + nodeGeometry(q, registry, ids[m.tag]!)!.width / 2;
      const [a, b] = segs[m.section - 1]!;
      expect(cx).toBeGreaterThanOrEqual(a);
      expect(cx).toBeLessThanOrEqual(b);
    }
    // El CCM se alargó (las secciones quedan del ancho de la más llena).
    expect(q.diagram.nodes[ids.B!]!.length!).toBeGreaterThan(220);
  });

  it("tablero: separa los circuitos y alarga la barra; deshacer = proyecto original", () => {
    const motors = [
      { tag: "M-01", x: 120 },
      { tag: "M-02", x: 125 },
      { tag: "M-03", x: 130 },
    ];
    const { p, ids } = build("panelboard", motors);
    const q = distributeBus(p, registry, ids.B!, (id) => (id === ids.B ? [] : LINES));
    const spans = motors.map((m) => span(q, ids[m.tag]!)).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]);
    const bus = busGeometry(q, registry, ids.B!)!;
    for (const m of motors) {
      const n = q.diagram.nodes[ids[m.tag]!]!;
      expect(n.x + 20).toBeLessThanOrEqual(bus.cx + bus.halfLength);
    }
    // La función no modifica el proyecto de entrada.
    expect(p.diagram.nodes[ids["M-02"]!]!.x).toBe(125);
  });
});
