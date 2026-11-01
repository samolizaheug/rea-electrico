import { addElement, createDefaultRegistry, createProject, type Project } from "@rea/core";
import { describe, expect, it } from "vitest";
import { nudgeElements } from "../src/editor/arrange";

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

describe("acomodar la selección", () => {
  it("desplaza todo junto", () => {
    const { p, ids } = three();
    const q = nudgeElements(p, ids, 20, -40);
    for (const id of ids) {
      expect(q.diagram.nodes[id]!.x).toBe(p.diagram.nodes[id]!.x + 20);
      expect(q.diagram.nodes[id]!.y).toBe(p.diagram.nodes[id]!.y - 40);
    }
  });
});
