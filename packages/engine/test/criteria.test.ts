import { createProject, updateSettings } from "@rea/core";
import { describe, expect, it } from "vitest";
import { validateDesignCriteria, type VoltageDropCriteria } from "../src";

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
