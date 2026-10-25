import { createDefaultRegistry } from "@rea/core";
import { runSizing } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { describe, expect, it } from "vitest";
import { sistemaEjemplo } from "../src";

/**
 * Dimensionamiento del sistema de ejemplo (docs/ejemplos/dimensionamiento.md), derivado a mano.
 * Formato: [corriente de diseño A, carga A, protección A, calibre, criterio, ampacidad A, tierra].
 */
const SELECCION: Record<string, [number, number, number | undefined, string, string, number, string | undefined]> = {
  "AL-1": [126.61, 110.36, 200, "1", "ampacidad", 130, "6"],
  "AL-11": [81.25, 65, 175, "4", "ampacidad", 85, "6"],
  "AL-12": [39.2, 31.36, 40, "8", "ampacidad", 40, "10"],
  "AL-13": [17.5, 14, 35, "14", "ampacidad", 20, "14"],
  "AL-2": [90.21, 90.21, 125, "2", "proteccion", 115, "6"],
  // AL-3 (secundario de TR-2, sin protección en su origen): puente de unión del lado de alimentación,
  // 250-102(c)(1) con la Tabla 250-66: fase 6 AWG (13.3 mm² ≤ 33.6 mm²) → 8 AWG Cu.
  "AL-3": [51.16, 50.43, undefined, "6", "ampacidad", 55, "8"],
  "AL-21": [10.93, 8.75, 15, "12", "caida-de-tension", 20, "12"],
  "AL-22": [11.34, 11.34, 15, "12", "caida-de-tension", 20, "12"],
  "AL-23": [43.74, 43.74, 45, "6", "ampacidad", 55, "10"],
  "AL-4": [53.12, 52.12, 60, "6", "ampacidad", 55, "10"],
  "AL-41": [15.04, 12.03, 16, "12", "ampacidad", 20, "12"],
  "AL-42": [48.11, 48.11, 50, "6", "ampacidad", 55, "10"],
};

const registry = createDefaultRegistry();

function run(selection: boolean) {
  const p = sistemaEjemplo();
  if (selection) for (const e of p.elements) if (e.type === "cable") e.params.forcedSize = null;
  const r = runSizing(p, registry, nom001Sede2012);
  const byTag = (tag: string) => [...r.circuits.values()].find((c) => c.tag === tag)!;
  return { r, byTag };
}

describe("dimensionamiento del sistema de ejemplo: selección automática", () => {
  const { r, byTag } = run(true);

  it("dimensiona los 12 circuitos", () => {
    expect(r.calculated).toBe(true);
    expect(r.circuits.size).toBe(12);
  });

  it("corriente de diseño, protección, calibre, criterio que rige, ampacidad y tierra", () => {
    for (const [tag, [id, il, prot, size, gov, amp, egc]] of Object.entries(SELECCION)) {
      const c = byTag(tag);
      expect(c.protection.designA, `${tag} diseño`).toBeCloseTo(id, 2);
      expect(c.protection.loadA, `${tag} carga`).toBeCloseTo(il, 2);
      expect(c.protection.ratingA, `${tag} protección`).toBe(prot);
      expect(c.conductor.designation, `${tag} calibre`).toBe(size);
      expect(c.conductor.governing, `${tag} criterio`).toBe(gov);
      expect(c.conductor.ampacityA, `${tag} ampacidad`).toBeCloseTo(amp, 6);
      expect(c.conductor.egc?.designation, `${tag} tierra`).toBe(egc);
    }
  });

  it("observaciones esperadas: variador (430-130) y secundario de TR-2 (240-21(c))", () => {
    const msgs = r.issues.map((i) => `${i.severity}: ${i.message}`);
    expect(msgs).toEqual([
      "info: VFD-01: confirme la protección con el fabricante del variador (430-130).",
      expect.stringMatching(/^warning: AL-3: conductores del secundario sin protección en su origen; verifique las condiciones de 240-21\(c\)/),
    ]);
  });

  it("el flujo final con los calibres seleccionados cumple los límites de caída", () => {
    expect(r.loadFlow.issues.filter((i) => i.code.startsWith("caida"))).toEqual([]);
  });
});

describe("dimensionamiento del sistema de ejemplo: verificación de los calibres fijados", () => {
  const { r, byTag } = run(false);

  it("todos los calibres fijados cumplen", () => {
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect([...r.circuits.values()].every((c) => c.conductor.governing === "fijado")).toBe(true);
  });

  it("aumento proporcional del conductor de tierra cuando el calibre fijado es mayor (250-122(b))", () => {
    // AL-1: 2/0 fijado contra 1 AWG mínimo: 13.30 · 67.43 / 42.41 = 21.15 mm² → 4 AWG.
    expect(byTag("AL-1").conductor.egc?.designation).toBe("4");
    // AL-4: 4 AWG fijado contra 6 AWG mínimo: 5.261 · 21.15 / 13.3 = 8.37 mm² → 8 AWG.
    expect(byTag("AL-4").conductor.egc?.designation).toBe("8");
  });

  it("la memoria cita los artículos aplicados", () => {
    const steps = [...byTag("AL-1").protection.steps, ...byTag("AL-1").conductor.steps];
    const refs = steps.flatMap((s) => s.refs ?? []);
    expect(refs).toEqual(expect.arrayContaining(["NOM-001-SEDE-2012 430-24", "NOM-001-SEDE-2012 430-62(a)", "NOM-001-SEDE-2012 110-14(c)", "NOM-001-SEDE-2012 Tabla 250-122 (p. 134 del PDF)"]));
  });

  it("secundario de TR-2: puente de unión con la Tabla 250-66 y su página", () => {
    const step = byTag("AL-3").conductor.steps.find((s) => s.label.startsWith("Puente de unión"))!;
    // Calibre fijado del ejemplo: 250 kcmil (127 mm²) → renglón «más de 3/0 a 350» → 2 AWG Cu.
    expect(step.result).toBe("2 AWG");
    expect(step.refs).toContain("NOM-001-SEDE-2012 Tabla 250-66 (p. 122 del PDF)");
  });
});
