import type { ParamValue } from "@rea/core";
import type { DropEvaluator, SizingCircuit, SizingLoadItem } from "@rea/engine";
import { describe, expect, it } from "vitest";
import { nomSizing } from "../src";

const noDrop: DropEvaluator = () => ({ pct: 0, limitPct: 3, limitSource: "prueba" });

function circuit(items: SizingLoadItem[], params: Record<string, ParamValue> = {}, extra: Partial<SizingCircuit> = {}): SizingCircuit {
  return {
    cableId: "c",
    tag: "AL",
    params: { material: "Cu", insulationType: "THHW-LS", installationMethod: "conduit-pvc-40", conductorsPerPhase: 1, terminalTempC: "auto", lengthM: 10, includeEgc: true, ...params },
    circuitKind: "derivado",
    m: 3,
    system: "3F3H",
    vNomLL: 480,
    vc: 480 / Math.sqrt(3),
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
const load = (amps: number, continuous = false, extra: Partial<SizingLoadItem> = {}): SizingLoadItem => ({ elementId: "l", tag: "CG", kind: "carga", amps, continuous, continuousSource: "prueba", ...extra });
const size = (c: SizingCircuit, drop: DropEvaluator = noDrop) => {
  const p = nomSizing.protection(c);
  return { p, cd: nomSizing.conductor(c, p, drop) };
};

describe("NOM: corriente de diseño y protección", () => {
  it("carga continua al 125 %; con ensamble aprobado al 100 %, al 100 %", () => {
    expect(size(circuit([load(80, true)])).p).toMatchObject({ designA: 100, loadA: 80, ratingA: 100 });
    expect(size(circuit([load(80, true)], {}, { assembly100: true })).p).toMatchObject({ designA: 80, ratingA: 80 });
  });

  it("transformador con corriente primaria menor de 9 A: hasta 167 % sin valor superior", () => {
    const t: SizingLoadItem = { elementId: "t", tag: "TR", kind: "transformador", amps: 6.01, transformer: { ratedPrimaryA: 6.01, sn: 5000, primaryV: 480 } };
    // 1.67 · 6.01 = 10.04 A. La lista de 240-6(a) para interruptores empieza en 15 A: no hay valor
    // estándar no mayor (10 A existe solo para fusibles) → se reporta el error.
    const p = nomSizing.protection(circuit([t]));
    expect(p.ratingA).toBeUndefined();
    expect(p.issues.some((i) => i.message.includes("no hay un valor estándar"))).toBe(true);
  });

  it("motor de servicio intermitente: 430-22(e) con corriente de placa", () => {
    const m: SizingLoadItem = { elementId: "m", tag: "M", kind: "motor", amps: 14, motor: { flcA: 14, flcSource: "tabla", motorType: "jaula", dutyClass: "intermitente", dutyRating: "15min", designLetter: "B", nameplateA: 13 } };
    const p = nomSizing.protection(circuit([m]));
    expect(p.designA).toBeCloseTo(0.85 * 13, 9);
    expect(p.ratingA).toBe(35); // 250 % · 14 = 35 A
  });

  it("protección fijada mayor que la permitida por 430-52: error", () => {
    const m: SizingLoadItem = { elementId: "m", tag: "M", kind: "motor", amps: 14, motor: { flcA: 14, flcSource: "tabla", motorType: "jaula", dutyClass: "continuo", dutyRating: "continuo", designLetter: "B", nameplateA: null } };
    const p = nomSizing.protection(circuit([m], {}, { breaker: { elementId: "b", tag: "INT", params: { deviceType: "itm", forcedRatingA: 50 } } }));
    expect(p.issues.some((i) => i.severity === "error" && i.message.includes("excede el máximo"))).toBe(true);
  });
});

describe("NOM: ampacidad", () => {
  it("temperatura ambiente de 40 °C y 6 conductores en la canalización", () => {
    // 50 A no continua, protección 50 A (≤ 100 A → terminales 60 °C).
    // 8 AWG: 60 °C 40 A < 50 ✗; 6 AWG: 60 °C 55 A ✓; corregida 90 °C 75 · 0.91 · 0.80 = 54.6 A ≥ 50 ✓;
    // protección 50 ≤ estándar siguiente a 54.6 (60) ✓.
    const { cd } = size(circuit([load(50)], { groupedConductors: 6 }, { ambientC: 40 }));
    expect(cd.designation).toBe("6");
    expect(cd.ampacityA).toBeCloseTo(54.6, 9);
  });

  it("calibres pequeños limitados por 240-4(d)", () => {
    // 21 A no continua, terminales de 75 °C → protección 25 A. 12 AWG: 25 A de ampacidad (cumple),
    // pero 240-4(d) limita su protección a 20 A → 10 AWG; rige la protección.
    const { p, cd } = size(circuit([load(21)], { terminalTempC: "75" }));
    expect(p.ratingA).toBe(25);
    expect(cd.designation).toBe("10");
    expect(cd.governing).toBe("proteccion");
  });

  it("circuito con varios contactos: sin valor estándar inmediato superior (240-4(b)(1))", () => {
    // 28 A con 10 contactos → protección 30 A; 10 AWG a 60 °C = 30 A ✓ (igual, no menor).
    const ok = size(circuit([load(28, false, { receptacleOutlets: 10 })]));
    expect(ok.p.nextHigherAllowed).toBe(false);
    expect(ok.cd.designation).toBe("10");
  });

  it("charola: cable multiconductor con tapa (× 0.95) y unipolares (× 0.65, mínimo 1/0)", () => {
    const multi = size(circuit([load(150)], { installationMethod: "charola-escalera", trayCableType: "multiconductor", trayCovered: true }));
    // Protección 150 A (>100 → 75 °C). 1/0: 75 °C 150 ✓; corregida 90 °C 170 · 0.95 = 161.5 → mín(161.5,150)=150 ✓.
    expect(multi.cd.designation).toBe("1/0");
    expect(multi.cd.ampacityA).toBeCloseTo(150, 9);
    const uni = size(circuit([load(150)], { installationMethod: "charola-escalera", trayCableType: "unipolar" }));
    // Tabla (b)(17): 1/0 90 °C 260 · 0.65 = 169 A; terminales 75 °C de (b)(17): 230 → 169 ≥ 150 ✓.
    expect(uni.cd.designation).toBe("1/0");
    expect(uni.cd.ampacityA).toBeCloseTo(169, 9);
  });

  it("aluminio y conductores en paralelo (mínimo 1/0, tierra en cada canalización)", () => {
    const { p, cd } = size(circuit([load(400)], { material: "Al", conductorsPerPhase: 2 }));
    expect(p.ratingA).toBe(400);
    // 2 × 3/0 Al: 75 °C 155 · 2 = 310 < 400; 2 × 250 kcmil: 205 · 2 = 410 ✓.
    expect(cd.designation).toBe("250");
    expect(cd.egc).toMatchObject({ designation: "1", perRaceway: true });
  });

  it("aumenta el calibre por caída de tensión y ajusta la tierra proporcionalmente", () => {
    const drop: DropEvaluator = (d) => ({ pct: ({ "14": 5, "12": 3.5, "10": 2 } as Record<string, number>)[d] ?? 1, limitPct: 3, limitSource: "prueba" });
    const { cd } = size(circuit([load(10)]), drop);
    expect(cd.designation).toBe("10");
    expect(cd.governing).toBe("caida-de-tension");
    // Tierra: 15 A → 14 AWG; 2.08 · 5.261 / 2.08 = 5.26 mm² → 10 AWG.
    expect(cd.egc?.designation).toBe("10");
  });

  it("calibre fijado insuficiente: error con la razón", () => {
    const { cd } = size(circuit([load(50)], { forcedSize: "10" }));
    expect(cd.issues.some((i) => i.severity === "error" && i.message.includes("110-14(c)"))).toBe(true);
  });
});
