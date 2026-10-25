import { addElement, connect, createDefaultRegistry, createProject, type ParamValue, type Project } from "@rea/core";
import { DEFAULT_EQUIPMENT_VOLTAGE, runSizing, validateTopology } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { describe, expect, it } from "vitest";

/** Acometida de 23 kV → cable de media tensión → transformador 23 kV / 220 V → tablero → interruptor → cable → carga. */
const registry = createDefaultRegistry();
function sistema(insulationKV: string): { p: Project; id: (t: string) => string } {
  let p = createProject({ name: "MT" });
  const ids: Record<string, string> = {};
  const add = (tag: string, type: string, params: Record<string, ParamValue>) => {
    const r = addElement(p, registry, type, { tag, params });
    p = r.project;
    ids[tag] = r.elementId;
  };
  const wire = (a: string, b: string) => {
    const [ea, pa] = a.split(".");
    const [eb, pb] = b.split(".");
    p = connect(p, registry, { elementId: ids[ea!]!, portId: pa! }, { elementId: ids[eb!]!, portId: pb! }).project;
  };
  add("ACOM", "utility", { voltageV: 23000, system: "3F3H" });
  add("MT-1", "cable-mt", { lengthM: 80, insulationKV, forcedSize: "1/0" });
  add("TR-1", "transformer", { ratedKVA: 150, primaryVoltageV: 23000, primarySystem: "3F3H", secondaryVoltageV: 220, system: "3F4H", impedancePct: 4.5, xrRatio: 3 });
  add("TG", "panelboard", { voltageV: 220, system: "3F4H" });
  add("INT", "breaker", {});
  add("AL", "cable", { insulationType: "THHW-LS", installationMethod: "conduit-pvc-40", lengthM: 20 });
  add("CG", "generic-load", { power: 20, powerUnit: "kW", powerFactor: 0.9, voltageV: 220, system: "3F3H" });
  wire("ACOM.out", "MT-1.from");
  wire("MT-1.to", "TR-1.primary");
  wire("TR-1.secondary", "TG.bus");
  wire("TG.bus", "INT.line");
  wire("INT.load", "AL.from");
  wire("AL.to", "CG.in");
  return { p, id: (t) => ids[t]! };
}

describe("cable de media tensión", () => {
  it("23 kV con cable de 25 kV: la red es válida y se calcula la baja tensión; el cable MT solo informa", () => {
    const { p, id } = sistema("25");
    expect(validateTopology(p, registry, DEFAULT_EQUIPMENT_VOLTAGE).issues.filter((i) => i.severity === "error")).toEqual([]);
    const s = runSizing(p, registry, nom001Sede2012);
    expect(s.calculated).toBe(true);
    expect(s.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(s.issues.find((i) => i.code === "cable-mt")?.severity).toBe("info");
    // El cable MT conduce la corriente del primario: 150 kVA a plena carga sería 3.77 A; aquí, la de la carga.
    expect(s.loadFlow.elements.get(id("MT-1"))!.currentA).toBeGreaterThan(0);
    expect(s.circuits.get(id("AL"))!.conductor.designation).not.toBe("—");
  });

  it("clase de aislamiento menor que la tensión del sistema: error", () => {
    const s = runSizing(sistema("15").p, registry, nom001Sede2012);
    expect(s.issues.some((i) => i.severity === "error" && i.code === "aislamiento-mt")).toBe(true);
  });
});
