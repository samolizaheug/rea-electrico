import { createDefaultRegistry } from "@rea/core";
import { runLoadFlow, validateTopology } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { describe, expect, it } from "vitest";
import { sistemaEjemplo } from "../src";

/**
 * Valores del cálculo a mano (docs/ejemplos/sistema-ejemplo.md). Se obtuvieron con aritmética
 * directa de las fórmulas del método nominal, sin usar el motor.
 */
const MANO = {
  potenciaKVA: { "M-01": 54.04, "VFD-01": 26.0738, "M-03": 11.63938, "L-01": 1.11111, "C-01": 1.44, "CG-01": 16.66667, "L-02": 3.33333, "CA-01": 40 },
  totalTG: { pKW: 136.89357, qKvar: 70.00569, sKVA: 153.75515 },
  corrienteA: { "AL-1": 109.7312, "AL-11": 65, "AL-12": 31.3619, "AL-13": 14, "AL-2": 23.1154, "AL-3": 50.4336, "AL-21": 8.7477, "AL-22": 11.3371, "AL-23": 43.7387, "AL-4": 52.1219, "AL-41": 12.0281, "AL-42": 48.1125 },
  caidaPct: { "TR-1": 0.7019, "AL-1": 0.5931, "AL-11": 0.5692, "AL-12": 0.8483, "AL-13": 0.868, "AL-2": 0.1127, "TR-2": 0.8121, "AL-3": 0.0845, "AL-21": 2.4864, "AL-22": 2.6853, "AL-23": 2.0961, "AL-4": 0.9276, "AL-41": 2.0893, "AL-42": 0.5284 },
  tensionPct: { TG: 99.2981, "CCM-1": 98.705, "M-01": 98.1357, "M-03": 97.8369, "M-02": 100, "TAB-A": 98.2888, "L-01": 95.8023, "C-01": 95.6034, "CG-01": 96.1926, "TAB-B": 98.3704, "L-02": 96.2811, "CA-01": 97.842 },
  caidaAcumuladaPct: { "M-01": 1.1623, "M-03": 1.4611, "L-01": 2.5709, "C-01": 2.7698, "CG-01": 2.1806, "L-02": 3.0169, "CA-01": 1.456 },
  transformadores: { "TR-1": { prim: 3.8596, sec: 184.939 }, "TR-2": { prim: 23.115, sec: 50.434 } },
};

const registry = createDefaultRegistry();
const project = sistemaEjemplo();
const byTag = (tag: string) => project.elements.find((e) => e.tag === tag)!.id;

describe("sistema de ejemplo: modelo", () => {
  it("la topología es válida y sin observaciones", () => {
    expect(validateTopology(project, registry).issues).toEqual([]);
  });
});

describe("sistema de ejemplo: método nominal contra el cálculo a mano", () => {
  const r = runLoadFlow(project, registry, nom001Sede2012, { mode: "nominal" });
  const f = (tag: string) => r.elements.get(byTag(tag))!;

  it("se calcula sin errores ni advertencias", () => {
    expect(r.calculated).toBe(true);
    expect(r.issues.filter((i) => i.severity !== "info")).toEqual([]);
  });

  it("potencias de las cargas y total en el tablero general", () => {
    for (const [tag, kva] of Object.entries(MANO.potenciaKVA)) expect(f(tag).power!.sKVA, tag).toBeCloseTo(kva, 3);
    const tg = f("TG").power!;
    expect(tg.pKW).toBeCloseTo(MANO.totalTG.pKW, 3);
    expect(tg.qKvar).toBeCloseTo(MANO.totalTG.qKvar, 3);
    expect(tg.sKVA).toBeCloseTo(MANO.totalTG.sKVA, 3);
  });

  it("corrientes de los alimentadores y circuitos derivados", () => {
    for (const [tag, a] of Object.entries(MANO.corrienteA)) expect(f(tag).currentA, tag).toBeCloseTo(a, 3);
    for (const [tag, t] of Object.entries(MANO.transformadores)) {
      expect(f(tag).currentA, `${tag} primario`).toBeCloseTo(t.prim, 3);
      expect(f(tag).currentSecondaryA, `${tag} secundario`).toBeCloseTo(t.sec, 2);
    }
  });

  it("caídas de tensión por tramo y regulación de transformadores", () => {
    for (const [tag, pct] of Object.entries(MANO.caidaPct)) expect(f(tag).dropPct, tag).toBeCloseTo(pct, 3);
  });

  it("tensiones en barras y cargas (% de la nominal) y caída acumulada en conductores", () => {
    for (const [tag, pct] of Object.entries(MANO.tensionPct)) expect(f(tag).voltage!.pct, tag).toBeCloseTo(pct, 3);
    for (const [tag, pct] of Object.entries(MANO.caidaAcumuladaPct)) expect(f(tag).cumulativeDropPct, tag).toBeCloseTo(pct, 3);
  });

  it("clasifica alimentadores y circuitos derivados", () => {
    expect(["AL-1", "AL-2", "AL-3", "AL-4"].map((t) => f(t).circuitKind)).toEqual(["alimentador", "alimentador", "alimentador", "alimentador"]);
    expect(["AL-11", "AL-12", "AL-13", "AL-21", "AL-22", "AL-23", "AL-41", "AL-42"].every((t) => f(t).circuitKind === "derivado")).toBe(true);
  });

  it("cada resultado lleva su memoria con referencias", () => {
    const m01 = f("M-01").traces.flatMap((t) => t.steps);
    const flc = m01.find((s) => s.label.startsWith("Corriente a plena carga"))!;
    expect(flc.refs).toContain("NOM-001-SEDE-2012 Tabla 430-250");
    expect(flc.substitution).toContain("columna de 460 V");
    expect(flc.result).toBe("65.0 A");
    const al21 = f("AL-21").traces.flatMap((t) => t.steps);
    expect(al21.find((s) => s.label.startsWith("Caída de tensión"))!.formula).toContain("2 · I");
  });
});

describe("sistema de ejemplo: barrido iterativo", () => {
  const nom = runLoadFlow(project, registry, nom001Sede2012, { mode: "nominal" });
  const bar = runLoadFlow(project, registry, nom001Sede2012, { mode: "barrido" });
  const g = (r: typeof bar, tag: string) => r.elements.get(byTag(tag))!;

  it("converge en pocas iteraciones", () => {
    expect(bar.converged).toBe(true);
    expect(bar.iterations).toBeLessThan(15);
  });

  it("las tensiones del barrido quedan a menos de 0.25 puntos del método nominal y siempre por debajo", () => {
    // El barrido evalúa las cargas de potencia constante a la tensión real (corriente mayor) e incluye
    // pérdidas: sus caídas son algo mayores. La diferencia crece con la caída (≈ 0.18 puntos en L-01).
    for (const tag of Object.keys(MANO.tensionPct)) {
      const d = g(nom, tag).voltage!.pct - g(bar, tag).voltage!.pct;
      expect(Math.abs(d), tag).toBeLessThan(0.25);
      if (tag !== "M-02") expect(d, tag).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it("el barrido incluye pérdidas: la potencia de la fuente es mayor que la suma de las cargas", () => {
    const pSrc = g(bar, "ACOM-1").power!.pKW;
    expect(pSrc).toBeGreaterThan(MANO.totalTG.pKW);
    expect(pSrc).toBeLessThan(MANO.totalTG.pKW * 1.03);
  });
});
