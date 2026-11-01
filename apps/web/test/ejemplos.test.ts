import type { Project } from "@rea/core";
import { EJEMPLOS } from "@rea/ejemplos";
import { describe, expect, it } from "vitest";
import { computeValidation } from "../src/state/validation";

const count = (p: Project, type: string) => p.elements.filter((e) => e.type === type).length;
const built = new Map(EJEMPLOS.map((e) => [e.id, e.build()]));

describe("ejemplos del menú", () => {
  it.each(EJEMPLOS.map((e) => [e.id]))("%s: calcula sin errores", (id) => {
    const p = built.get(id)!;
    const v = computeValidation(p);
    expect(v.issues.filter((i) => i.severity === "error").map((i) => i.message)).toEqual([]);
    expect(v.results).not.toBeNull();
    // Ningún elemento queda encimado con otro en el mismo lugar.
    const spots = Object.values(p.diagram.nodes).map((n) => `${Math.round(n.x)},${Math.round(n.y)}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it("cada ejemplo muestra su variante", () => {
    const p = (id: string) => built.get(id)!;
    expect(count(p("planta-2-ccm"), "mcc")).toBe(2);
    expect(count(p("hospital-generador"), "generator")).toBe(1);
    expect(count(p("hospital-generador"), "ats")).toBe(1);
    expect(p("hospital-generador").elements.some((e) => e.params.firePump === true)).toBe(true);
    expect(count(p("centro-datos-ups"), "ups")).toBe(2);
    expect(count(p("centro-datos-ups"), "generator")).toBe(1);
    expect(count(p("estacion-bombeo"), "cable-mt")).toBe(1);
    // Edificio: el secundario de 220 V lleva conductores en paralelo (automático).
    const ed = p("edificio-comercial");
    const s1 = ed.elements.find((e) => e.tag === "AL-S1")!.id;
    expect(computeValidation(ed).results!.sizing.circuits.get(s1)!.conductor.conductorsPerPhase).toBeGreaterThan(1);
    // Bombeo: el pozo a 400 m queda dimensionado por caída de tensión.
    const bo = p("estacion-bombeo");
    const p5 = bo.elements.find((e) => e.tag === "AL-P5")!.id;
    expect(computeValidation(bo).results!.sizing.circuits.get(p5)!.conductor.governing).toBe("caida-de-tension");
  });
});
