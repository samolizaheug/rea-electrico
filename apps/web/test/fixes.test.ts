import { updateParams, type Project } from "@rea/core";
import { sistemaEjemplo } from "@rea/ejemplos";
import { describe, expect, it } from "vitest";
import { canSearchFix, hintFor, searchFixes } from "../src/state/fixes";
import { computeValidation, type UiIssue } from "../src/state/validation";

const byTag = (p: Project, tag: string) => p.elements.find((e) => e.tag === tag)!;
const issueOf = (p: Project, code: string, tag: string): UiIssue => {
  const v = computeValidation(p);
  const id = byTag(p, tag).id;
  const i = v.issues.find((x) => x.code === code && x.elementIds.includes(id));
  if (!i) throw new Error(`sin observación ${code} en ${tag}: ${v.issues.map((x) => x.code).join(", ")}`);
  return i;
};
/** Aplica la corrección y comprueba que la observación desaparece sin errores nuevos. */
function check(p: Project, issue: UiIssue) {
  const base = computeValidation(p);
  const fixes = searchFixes(issue, p, base);
  expect(fixes.length).toBeGreaterThan(0);
  for (const f of fixes) {
    const after = computeValidation(f.apply(p));
    expect(after.issues.some((i) => i.code === issue.code && i.elementIds.join() === issue.elementIds.join())).toBe(false);
    expect(after.errors).toBeLessThanOrEqual(base.errors);
  }
  return fixes;
}

describe("soluciones propuestas en el panel de validación", () => {
  it("polos del interruptor: iguala los polos a las fases del circuito", () => {
    let p = sistemaEjemplo();
    p = updateParams(p, byTag(p, "INT-11").id, { poles: "2" });
    const fixes = check(p, issueOf(p, "polos-interruptor", "INT-11"));
    expect(fixes[0]!.label).toBe("INT-11: polos 2 → 3");
  });

  it("marco menor que el disparo: deja el marco vacío", () => {
    let p = sistemaEjemplo();
    p = updateParams(p, byTag(p, "INT-11").id, { frameA: 15 });
    const fixes = check(p, issueOf(p, "marco-interruptor", "INT-11"));
    expect(fixes[0]!.label).toMatch(/^INT-11: corriente de marco 15 A → vacía/);
  });

  it("caída de tensión: propone el calibre inmediato superior que la resuelve", () => {
    let p = sistemaEjemplo();
    p = updateParams(p, byTag(p, "AL-41").id, { lengthM: 400 });
    const issue = computeValidation(p).issues.find((i) => i.code?.startsWith("caida") || i.code === "tension-terminales");
    expect(issue).toBeDefined();
    expect(canSearchFix(issue!)).toBe(true);
    const fixes = check(p, issue!);
    expect(fixes.some((f) => /calibre .* → .*\(calibre fijado\)/.test(f.label))).toBe(true);
  });

  it("caída en el dimensionamiento del cable: propone su calibre", () => {
    let p = sistemaEjemplo();
    p = updateParams(p, byTag(p, "AL-41").id, { lengthM: 400 });
    const issue = computeValidation(p).issues.find((i) => i.code === "dimensionamiento" && /caída de tensión/.test(i.message));
    expect(issue).toBeDefined();
    const fixes = check(p, issue!);
    expect(fixes[0]!.label).toMatch(/^AL-41: calibre /);
  });

  it("todas las observaciones tienen una sugerencia", () => {
    const p = sistemaEjemplo();
    const v = computeValidation(updateParams(p, byTag(p, "INT-11").id, { poles: "2" }));
    for (const i of v.issues) expect(hintFor(i, p)).not.toBe("");
  });
});
