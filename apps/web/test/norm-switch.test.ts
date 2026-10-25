import { sistemaEjemplo } from "@rea/ejemplos";
import { getNormModule } from "@rea/norms";
import { describe, expect, it } from "vitest";
import { adaptToNorm } from "../src/state/norm-switch";

describe("cambio de norma", () => {
  const nom = sistemaEjemplo();
  const iec = getNormModule("iec-60364", "2001");
  const r = adaptToNorm(nom, iec);
  const el = (tag: string) => r.project.elements.find((e) => e.tag === tag)!;

  it("aislamiento y método inexistentes en IEC se cambian por los valores por defecto de la norma", () => {
    expect(el("AL-1").params).toMatchObject({ insulationType: "PVC", installationMethod: "B1" });
    expect(r.project.settings.norm).toEqual({ id: "iec-60364", edition: "2001" });
  });

  it("los calibres fijados se vacían aunque el texto coincida («4» AWG ≠ «4» mm²)", () => {
    // En el ejemplo NOM, AL-4 tiene fijado «4» (AWG), que también existe como sección IEC (4 mm²).
    expect(nom.elements.find((e) => e.tag === "AL-4")!.params.forcedSize).toBe("4");
    for (const e of r.project.elements.filter((x) => x.type === "cable")) expect(e.params.forcedSize ?? null).toBeNull();
  });

  it("los límites de caída del proyecto no quedan por encima de los de la norma", () => {
    expect(r.project.settings.voltageDrop.totalPct).toBe(4);
    expect(r.settingsChanged.join(" ")).toContain("total 5 → 4");
  });

  it("de regreso a la NOM se restablecen sus valores por defecto", () => {
    const back = adaptToNorm(r.project, getNormModule("nom-001-sede", "2012"));
    expect(back.project.elements.find((e) => e.tag === "AL-1")!.params).toMatchObject({ insulationType: "THHW-LS", installationMethod: "conduit-pvc-40" });
  });
});
