import { createProject, updateSettings } from "@rea/core";
import { describe, expect, it } from "vitest";
import { validateDesignCriteria, type VoltageDropCriteria } from "../src";
import { wiringText } from "../src";

const vd: VoltageDropCriteria = {
  branch: { pct: 3, mandatory: false, source: "210-19(a) Nota 4" },
  feeder: { pct: 3, mandatory: false, source: "215-2(a)(1) Nota 2" },
  total: { pct: 5, mandatory: false, source: "notas" },
  special: [],
};

describe("criterios de diseño contra la norma", () => {
  it("valores iguales o más estrictos que la norma son válidos", () => {
    const p = updateSettings(createProject({ name: "p" }), { voltageDrop: { branchPct: 2, feederPct: 3, totalPct: 4 } });
    expect(validateDesignCriteria(p, vd)).toEqual([]);
  });

  it("un límite mayor al de la norma es error y cita la fuente", () => {
    const p = updateSettings(createProject({ name: "p" }), { voltageDrop: { branchPct: 4, feederPct: 3, totalPct: 6 } });
    const issues = validateDesignCriteria(p, vd);
    expect(issues.map((i) => i.setting)).toEqual(["voltageDrop.branchPct", "voltageDrop.totalPct"]);
    expect(issues[0]!.message).toContain("(4 %) excede el de la norma (3 %, 210-19(a) Nota 4)");
  });

  it("sin criterios de norma no hay verificación", () => {
    expect(validateDesignCriteria(createProject({ name: "p" }), undefined)).toEqual([]);
  });
});

describe("configuración de conductores (wiringText)", () => {
  const cd = (designation: string, system: string, npar: number, egc?: [string, string]) =>
    ({ designation, system, conductorsPerPhase: npar, egc: egc ? { designation: egc[0], system: egc[1], areaMm2: 0, perRaceway: npar > 1 } : undefined }) as never;
  it("3 fases + tierra; con neutro; en paralelo; IEC con PE", () => {
    expect(wiringText({ conductor: cd("2", "AWG", 1, ["10", "AWG"]), wiring: { phases: 3, neutral: false, reason: "" } })).toBe("3x#2AWG(Ph)+1x#10AWG(Gnd)");
    expect(wiringText({ conductor: cd("2", "AWG", 1, ["10", "AWG"]), wiring: { phases: 3, neutral: true, reason: "" } })).toBe("3x#2AWG(Ph)+1x#2AWG(N)+1x#10AWG(Gnd)");
    expect(wiringText({ conductor: cd("2", "AWG", 2, ["10", "AWG"]), wiring: { phases: 3, neutral: false, reason: "" } })).toBe("2[3x#2AWG(Ph)+1x#10AWG(Gnd)]");
    expect(wiringText({ conductor: cd("250", "kcmil", 1, ["2", "AWG"]), wiring: { phases: 3, neutral: false, reason: "" } })).toBe("3x250kcmil(Ph)+1x#2AWG(Gnd)");
    expect(wiringText({ conductor: cd("25", "mm2", 1, ["16", "mm2"]), wiring: { phases: 3, neutral: true, reason: "" } })).toBe("3x25mm²(Ph)+1x25mm²(N)+1x16mm²(PE)");
  });
});
