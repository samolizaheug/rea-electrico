import { addElement, connect, createDefaultRegistry, createProject, updateSettings, type ParamValue, type Project } from "@rea/core";
import { runSizing, type DropEvaluator, type SizingCircuit, type SizingLoadItem } from "@rea/engine";
import { describe, expect, it } from "vitest";
import { getNormModule, iec60364_2001, iecCalc, iecSizing } from "../src";

/**
 * Dimensionamiento IEC 60364 (tablas ABB) contra cálculos a mano.
 * Caso base: 400 V trifásico, carga de 30 kW con FP 0.9 → Ib = 33 333 / (√3 · 400) = 48.11 A.
 */
const noDrop: DropEvaluator = () => ({ pct: 0, limitPct: 4, limitSource: "prueba" });
const IB = 30000 / 0.9 / (Math.sqrt(3) * 400);

function circuit(items: SizingLoadItem[], params: Record<string, ParamValue> = {}, extra: Partial<SizingCircuit> = {}): SizingCircuit {
  return {
    cableId: "c",
    tag: "AL",
    params: { material: "Cu", insulationType: "PVC", installationMethod: "B1", conductorsPerPhase: 1, lengthM: 50, includeEgc: true, ...params },
    circuitKind: "derivado",
    m: 3,
    system: "3F4H",
    vNomLL: 400,
    vc: 400 / Math.sqrt(3),
    items,
    breaker: { elementId: "b", tag: "INT", params: { deviceType: "itm", forcedRatingA: null } },
    assembly100: false,
    ambientC: 30,
    ambientSource: "prueba",
    transformerSecondary: false,
    downstreamMotorProtection: [],
    ...extra,
  };
}
const load = (amps: number): SizingLoadItem => ({ elementId: "l", tag: "CG", kind: "carga", amps, continuous: true, continuousSource: "prueba" });
const size = (c: SizingCircuit, drop: DropEvaluator = noDrop) => {
  const p = iecSizing.protection(c);
  return { p, cd: iecSizing.conductor(c, p, drop) };
};

describe("IEC: protección (433.1, Ib ≤ In ≤ Iz)", () => {
  it("sin 125 % para cargas continuas; In = valor de la serie inmediato superior", () => {
    const { p } = size(circuit([load(IB)]));
    expect(p.designA).toBeCloseTo(48.11, 2);
    expect(p.ratingA).toBe(50);
    expect(p.protectsConductor).toBe(true);
  });

  it("protección fijada menor que Ib: error", () => {
    const p = iecSizing.protection(circuit([load(IB)], {}, { breaker: { elementId: "b", tag: "INT", params: { deviceType: "itm", forcedRatingA: 40 } } }));
    expect(p.issues.some((i) => i.severity === "error" && i.message.includes("menor que Ib"))).toBe(true);
  });
});

describe("IEC: sección del conductor", () => {
  it("B1, Cu PVC, 3 cargados, 30 °C: 10 mm² (I0 = 50 A ≥ In 50 A); PE = 10 mm²", () => {
    const { cd } = size(circuit([load(IB)]));
    expect(cd).toMatchObject({ designation: "10", system: "mm2", ampacityA: 50, governing: "ampacidad" });
    expect(cd.egc).toMatchObject({ designation: "10" });
  });

  it("40 °C: k1 = 0.87 → 10 mm² da 43.5 A < Ib; 16 mm² da 68 · 0.87 = 59.16 A", () => {
    const { cd } = size(circuit([load(IB)], {}, { ambientC: 40 }));
    expect(cd.designation).toBe("16");
    expect(cd.ampacityA).toBeCloseTo(59.16, 2);
  });

  it("32 °C: se toma el renglón de 35 °C (k1 = 0.94, conservador)", () => {
    const { cd } = size(circuit([load(IB)], {}, { ambientC: 32 }));
    expect(cd.steps.find((s) => s.label.startsWith("Factor k1"))!.result).toBe("k1 = 0.94");
  });

  it("9 conductores agrupados = 3 circuitos (nota 5) → k2 = 0.70; 16 mm² da 47.6 A < Ib → 25 mm²; PE 16 mm²", () => {
    const { cd } = size(circuit([load(IB)], { groupedConductors: 9 }));
    expect(cd.designation).toBe("25");
    expect(cd.ampacityA).toBeCloseTo(89 * 0.7, 6);
    expect(cd.egc!.designation).toBe("16");
  });

  it("fusible: In ≤ 0.9·Iz → 10 mm² (0.9 · 50 = 45 < 50) no cumple, 16 mm²; rige la protección", () => {
    const { cd } = size(circuit([load(IB)], {}, { breaker: { elementId: "b", tag: "F", params: { deviceType: "fusible-sin-retardo", forcedRatingA: null } } }));
    expect(cd).toMatchObject({ designation: "16", governing: "proteccion" });
  });

  it("PE para S > 35: S/2 redondeado a la sección comercial (95 → 47.5 → 50 mm²)", () => {
    const { cd } = size(circuit([load(IB)], { forcedSize: "95" }));
    expect(cd.egc!.designation).toBe("50");
  });

  it("monofásico 230 V, 3 kW: Ib = 13.04 A → In 16 A; B1 2 cargados 1.5 mm² (17.5 A)", () => {
    const { p, cd } = size(circuit([load(3000 / 230)], {}, { m: 1, system: "1F2H", vNomLL: 230, vc: 230 }));
    expect(p.ratingA).toBe(16);
    expect(cd).toMatchObject({ designation: "1.5", ampacityA: 17.5 });
  });

  it("método D (enterrado): ampacidad de la Tabla 15 y advertencia por el cambio de la edición 2009", () => {
    const { cd } = size(circuit([load(IB)], { installationMethod: "D" }, { ambientC: 20 }));
    // D, Cu PVC, 3 cargados: 10 mm² = 52 A ≥ In 50 A.
    expect(cd).toMatchObject({ designation: "10", ampacityA: 52 });
    expect(cd.issues.some((i) => i.severity === "warning" && i.message.includes("2009"))).toBe(true);
  });

  it("método G no tiene columna de 2 conductores cargados: error", () => {
    const { cd } = size(circuit([load(10)], { installationMethod: "G-horizontal" }, { m: 1, system: "1F2H", vNomLL: 230, vc: 230 }));
    expect(cd.issues.some((i) => i.severity === "error" && i.message.includes("método G"))).toBe(true);
  });

  it("aislamiento de otra norma (THHW-LS): error claro", () => {
    const { cd } = size(circuit([load(IB)], { insulationType: "THHW-LS" }));
    expect(cd.issues[0]!.message).toContain("PVC o XLPE");
  });
});

describe("IEC: impedancia y frecuencia (ABB cap. 2.2.2)", () => {
  it("unipolar Cu 10 mm²: r = 2.24, x = 0.119 a 50 Hz; a 60 Hz x × 1.2 = 0.1428", () => {
    const q = { designation: "10", material: "Cu" as const, installationMethod: "B1" };
    expect(iecCalc.conductorImpedance({ ...q, frequencyHz: 50 })).toMatchObject({ ok: true, rOhmPerKm: 2.24, xOhmPerKm: 0.119 });
    expect(iecCalc.conductorImpedance({ ...q, frequencyHz: 60 })).toMatchObject({ ok: true, xOhmPerKm: 0.1428 });
  });
  it("multiconductor (B2) usa la columna de cable multiconductor", () => {
    expect(iecCalc.conductorImpedance({ designation: "10", material: "Cu", installationMethod: "B2" })).toMatchObject({ ok: true, rOhmPerKm: 2.27, xOhmPerKm: 0.0861 });
  });
  it("motores: tabla aproximada de la fuente con advertencia (7.5 kW, 380-400 V → 15.5 A)", () => {
    const r = iecCalc.motorFlc({ ratedPower: 7.5, ratedPowerUnit: "kW", voltageV: 400, phases: "3F", synchronous: false });
    expect(r).toMatchObject({ ok: true, amps: 15.5, tableVoltageV: 400 });
    expect(r.ok && r.warnings?.[0]).toContain("placa");
    // Por potencia en hp (PS) y tensión dentro del intervalo 220-230 V.
    expect(iecCalc.motorFlc({ ratedPower: 10, ratedPowerUnit: "hp", voltageV: 220, phases: "3F", synchronous: false })).toMatchObject({ ok: true, amps: 27.4, tableVoltageV: 230 });
  });
  it("motores: con η y FP capturados se calcula Ib = P / (√3·V·η·cosφ) (decisión 9): 7.5 kW, 400 V, 90 %, 0.85 → 14.15 A", () => {
    const r = iecCalc.motorFlc({ ratedPower: 7.5, ratedPowerUnit: "kW", voltageV: 400, phases: "3F", synchronous: false, efficiencyPct: 90, powerFactor: 0.85 });
    expect(r.ok && r.amps).toBeCloseTo(7500 / (Math.sqrt(3) * 400 * 0.9 * 0.85), 2);
    expect(r.ok && r.step?.label).toContain("calculada");
    // Funciona también a 480 V, donde la tabla aproximada no tiene columna.
    expect(iecCalc.motorFlc({ ratedPower: 10, ratedPowerUnit: "hp", voltageV: 480, phases: "3F", synchronous: false, efficiencyPct: 91, powerFactor: 0.86 }).ok).toBe(true);
  });
  it("motores: 480 V o monofásico no están en la tabla → se pide la placa", () => {
    expect(iecCalc.motorFlc({ ratedPower: 7.5, ratedPowerUnit: "kW", voltageV: 480, phases: "3F", synchronous: false }).ok).toBe(false);
    expect(iecCalc.motorFlc({ ratedPower: 0.75, ratedPowerUnit: "kW", voltageV: 230, phases: "1F", synchronous: false }).ok).toBe(false);
  });
});

describe("IEC: circuito completo con el motor de cálculo", () => {
  const registry = createDefaultRegistry();
  function project(freq: 50 | 60): { p: Project; id: (t: string) => string } {
    let p = updateSettings(createProject({ name: "IEC" }), { norm: { id: "iec-60364", edition: "2001" }, frequencyHz: freq, voltageDrop: { branchPct: 4, feederPct: 4, totalPct: 4 } });
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
    add("ACOM", "utility", { voltageV: 400, system: "3F4H" });
    add("TAB", "panelboard", { voltageV: 400, system: "3F4H" });
    add("INT", "breaker", {});
    add("AL", "cable", { material: "Cu", insulationType: "PVC", installationMethod: "B1", lengthM: 50 });
    add("CG", "generic-load", { power: 30, powerUnit: "kW", powerFactor: 0.9, voltageV: 400, system: "3F3H" });
    wire("ACOM.out", "TAB.bus");
    wire("TAB.bus", "INT.line");
    wire("INT.load", "AL.from");
    wire("AL.to", "CG.in");
    return { p, id: (t) => ids[t]! };
  }

  it("50 Hz: 10 mm², In 50 A, ΔV = 2.154 % (a mano: 48.11 A · (0.112·0.9 + 0.00595·0.4359) Ω / 230.94 V)", () => {
    const { p, id } = project(50);
    const s = runSizing(p, registry, getNormModule("iec-60364", "2001"));
    expect(s.calculated).toBe(true);
    const c = s.circuits.get(id("AL"))!;
    expect(c.conductor.designation).toBe("10");
    expect(c.protection.ratingA).toBe(50);
    expect(s.loadFlow.elements.get(id("AL"))!.dropPct).toBeCloseTo(2.15403, 4);
  });

  it("motor sin corriente de placa: se usa la tabla aproximada y aparece una advertencia", () => {
    const { p: base, id } = project(50);
    let p = base;
    const m = addElement(p, registry, "motor", { tag: "M-1", params: { ratedPower: 7.5, ratedPowerUnit: "kW", voltageV: 400, system: "3F3H", currentSource: "tabla" } });
    p = m.project;
    const cg = p.connections.find((c) => c.a.elementId === id("CG") || c.b.elementId === id("CG"))!;
    p = { ...p, connections: p.connections.filter((c) => c !== cg), elements: p.elements.filter((e) => e.id !== id("CG")) };
    p = connect(p, registry, { elementId: id("AL"), portId: "to" }, { elementId: m.elementId, portId: "in" }).project;
    const s = runSizing(p, registry, iec60364_2001);
    expect(s.calculated).toBe(true);
    expect(s.circuits.get(id("AL"))!.protection.loadA).toBe(15.5);
    expect(s.issues.some((i) => i.severity === "warning" && i.code === "dato-aproximado" && i.message.startsWith("M-1"))).toBe(true);
  });

  it("60 Hz: X × 1.2 → ΔV = 2.165 %", () => {
    const { p, id } = project(60);
    const s = runSizing(p, registry, iec60364_2001);
    expect(s.loadFlow.elements.get(id("AL"))!.dropPct).toBeCloseTo(2.16484, 4);
  });
});
