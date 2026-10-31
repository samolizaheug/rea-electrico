import { addElement, createDefaultRegistry, createProject, type Project } from "@rea/core";
import { nodeGeometry } from "@rea/symbols";
import { describe, expect, it } from "vitest";
import { alignElements, nudgeElements, spreadElements } from "../src/editor/arrange";

const registry = createDefaultRegistry();

function three() {
  let p: Project = createProject({ name: "arr" });
  const ids: string[] = [];
  for (const [type, x, y] of [["breaker", 100, 100], ["motor", 170, 140], ["panelboard", 400, 60]] as const) {
    const r = addElement(p, registry, type, { position: { x, y } });
    p = r.project;
    ids.push(r.elementId);
  }
  return { p, ids };
}
const box = (p: Project, id: string) => {
  const n = p.diagram.nodes[id]!;
  const g = nodeGeometry(p, registry, id)!;
  return { x: n.x, y: n.y, w: g.width, h: g.height };
};

describe("acomodar la selección", () => {
  it("desplaza todo junto", () => {
    const { p, ids } = three();
    const q = nudgeElements(p, ids, 20, -40);
    for (const id of ids) {
      expect(q.diagram.nodes[id]!.x).toBe(p.diagram.nodes[id]!.x + 20);
      expect(q.diagram.nodes[id]!.y).toBe(p.diagram.nodes[id]!.y - 40);
    }
  });

  it("alinea bordes y centros", () => {
    const { p, ids } = three();
    const left = alignElements(p, registry, ids, "left");
    expect(new Set(ids.map((id) => left.diagram.nodes[id]!.x))).toEqual(new Set([100]));
    const top = alignElements(p, registry, ids, "top");
    expect(new Set(ids.map((id) => top.diagram.nodes[id]!.y))).toEqual(new Set([60]));
    const center = alignElements(p, registry, ids, "center");
    const centers = ids.map((id) => {
      const b = box(center, id);
      return b.x + b.w / 2;
    });
    expect(Math.max(...centers) - Math.min(...centers)).toBe(0);
    const bottom = alignElements(p, registry, ids, "bottom");
    const bottoms = ids.map((id) => {
      const b = box(bottom, id);
      return b.y + b.h;
    });
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBe(0);
  });

  it("reparte con separación igual dejando fijos los extremos", () => {
    const { p, ids } = three();
    const q = spreadElements(p, registry, ids, "x");
    const bs = ids.map((id) => box(q, id)).sort((a, b) => a.x - b.x);
    const gaps = [bs[1]!.x - (bs[0]!.x + bs[0]!.w), bs[2]!.x - (bs[1]!.x + bs[1]!.w)];
    expect(Math.abs(gaps[0]! - gaps[1]!)).toBeLessThanOrEqual(1);
    expect(bs[0]!.x).toBe(100);
    expect(bs[2]!.x).toBe(400);
  });
});
