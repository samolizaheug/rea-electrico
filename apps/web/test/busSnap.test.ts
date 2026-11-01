import { addElement, createDefaultRegistry, createProject, resizeBus, type Project } from "@rea/core";
import { busGeometry } from "@rea/symbols";
import { describe, expect, it } from "vitest";
import { busAtPoint } from "../src/editor/busSnap";

const registry = createDefaultRegistry();

function withBus(type: "panelboard" | "mcc", params: Record<string, number> = {}) {
  let p: Project = createProject({ name: "snap" });
  const r = addElement(p, registry, type, { position: { x: 0, y: 100 }, params });
  p = resizeBus(r.project, r.elementId, 1200, 0, 100);
  return { p, id: r.elementId };
}

describe("soltar un cable sobre una barra", () => {
  it("cualquier punto de la barra sirve, aunque esté lejos de su punto de conexión", () => {
    const { p, id } = withBus("panelboard");
    const g = busGeometry(p, registry, id)!;
    // Extremo derecho de la barra, a 10 unidades del trazo.
    expect(busAtPoint(p, registry, g.cx + g.halfLength - 20, g.cy + 10, 20)).toEqual({ busId: id, portId: "bus" });
    // Lejos de la barra: nada.
    expect(busAtPoint(p, registry, g.cx, g.cy + 200, 20)).toBeNull();
    // El propio elemento que arrastra el cable no cuenta.
    expect(busAtPoint(p, registry, g.cx, g.cy, 20, id)).toBeNull();
  });

  it("en un CCM, por abajo elige la sección bajo el cursor; por arriba es la alimentación", () => {
    const { p, id } = withBus("mcc", { sections: 3 });
    const g = busGeometry(p, registry, id)!;
    const left = g.cx - g.halfLength;
    expect(busAtPoint(p, registry, left + 1000, g.cy + g.halfThickness, 20)).toEqual({ busId: id, portId: "bus", section: 3 });
    expect(busAtPoint(p, registry, left + 100, g.cy + g.halfThickness, 20)).toEqual({ busId: id, portId: "bus", section: 1 });
    expect(busAtPoint(p, registry, g.cx, g.cy - g.halfThickness, 20)).toEqual({ busId: id, portId: "bus" });
  });
});
