import { createDefaultRegistry, parseProject, serializeProject, updateParams, updateSettings, type Project } from "@rea/core";
import { runSizing } from "@rea/engine";
import { nom001Sede2012 } from "@rea/norms";
import { describe, expect, it } from "vitest";
import { sistemaEjemplo } from "../src";

const registry = createDefaultRegistry();
const byTag = (p: Project, tag: string) => p.elements.find((e) => e.tag === tag)!;

/** Carga de 400 kW en CG-01: su alimentador AL-23 (y el secundario AL-3) quedan sin calibre fijado. */
function grande(): Project {
  let p = sistemaEjemplo();
  p = updateParams(p, byTag(p, "CG-01").id, { power: 400, powerUnit: "kW" });
  for (const tag of ["AL-23", "AL-3"]) p = updateParams(p, byTag(p, tag).id, { forcedSize: null, conductorsPerPhase: null });
  return p;
}

describe("conductores en paralelo automáticos", () => {
  it("si un conductor de hasta 500 kcmil no alcanza, usa el menor número en paralelo que cumple", () => {
    const p = grande();
    const r = runSizing(p, registry, nom001Sede2012);
    const al23 = r.circuits.get(byTag(p, "AL-23").id)!.conductor;
    expect(al23.conductorsPerPhase).toBeGreaterThan(1);
    expect(al23.designation).not.toBe("—");
    // Cada conductor ≤ 500 kcmil y ≥ 1/0 (310-10(h)).
    expect(["1/0", "2/0", "3/0", "4/0", "250", "300", "350", "400", "500"]).toContain(al23.designation);
    expect(r.issues.some((i) => /AL-23: .*ningún calibre|no hay combinación/.test(i.message))).toBe(false);
    expect(al23.steps[0]!.label).toBe("Conductores en paralelo (automático)");
    // La memoria explica por qué: con un conductor menos de hasta 500 kcmil no se cumplía.
    expect(al23.steps[0]!.substitution).toContain(`con ${al23.conductorsPerPhase - 1} conductor(es) por fase de hasta 500 kcmil`);
    // El proyecto dimensionado (diagrama, cuadros) lleva el número de conductores.
    expect(r.sizedProject.elements.find((e) => e.tag === "AL-23")!.params.conductorsPerPhase).toBe(al23.conductorsPerPhase);
  });

  it("un número capturado se respeta tal cual", () => {
    const g = grande();
    const p = updateParams(g, byTag(g, "AL-23").id, { conductorsPerPhase: 1 });
    const r = runSizing(p, registry, nom001Sede2012);
    expect(r.circuits.get(byTag(p, "AL-23").id)!.conductor.conductorsPerPhase).toBe(1);
    expect(r.issues.some((i) => /AL-23: ningún calibre .* considere conductores en paralelo/.test(i.message))).toBe(true);
  });

  it("sin calibre máximo, usa un solo conductor mientras alguno alcance", () => {
    const g = grande();
    const p = updateSettings(g, { conductors: { maxSingleSize: null } });
    const r = runSizing(p, registry, nom001Sede2012);
    const c = r.circuits.get(byTag(p, "AL-23").id)!.conductor;
    const withMax = runSizing(g, registry, nom001Sede2012).circuits.get(byTag(g, "AL-23").id)!.conductor;
    expect(c.conductorsPerPhase).toBeLessThanOrEqual(withMax.conductorsPerPhase);
  });

  it("los proyectos de la versión 1 con 1 conductor por fase pasan a automático", () => {
    const doc = JSON.parse(serializeProject(sistemaEjemplo()));
    doc.schemaVersion = 1;
    const cable = doc.elements.find((e: { tag: string }) => e.tag === "AL-11");
    cable.params.conductorsPerPhase = 1;
    delete doc.settings.conductors;
    const { project } = parseProject(JSON.stringify(doc), registry);
    expect(project.schemaVersion).toBe(2);
    expect(byTag(project, "AL-11").params.conductorsPerPhase).toBeNull();
    expect(project.settings.conductors.maxSingleSize).toBe("500");
  });
});
