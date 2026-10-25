import { createDefaultRegistry, defaultParams, validateParams } from "@rea/core";
import { describe, expect, it } from "vitest";
import { getNormModule, nom001Sede2012, normModules } from "../src";

describe("módulos normativos", () => {
  it("la NOM-001-SEDE-2012 está disponible; NEC e IEC se listan como pendientes de datos", () => {
    expect(getNormModule("nom-001-sede", "2012").available).toBe(true);
    expect(normModules.filter((m) => !m.available).map((m) => m.label)).toEqual([
      "NEC (NFPA 70) 2020",
      "NEC (NFPA 70) 2023",
      "NEC (NFPA 70) 2026",
      "IEC 60364-5-52:2009+A1:2024",
    ]);
    expect(getNormModule("nec", "2023").options("norm:conductorSizes")).toBeUndefined();
  });

  it("ofrece aislamientos de la Tabla 310-104(a), métodos de instalación y calibres de 14 AWG a 2000 kcmil", () => {
    const ins = nom001Sede2012.options("norm:insulationTypes")!;
    expect(ins.map((o) => o.value)).toEqual(expect.arrayContaining(["THHW-LS", "THWN-2", "XHHW-2", "TW"]));
    expect(ins.find((o) => o.value === "THW")!.label).toBe("THW (75 °C mojados)");
    const sizes = nom001Sede2012.options("norm:conductorSizes")!;
    expect(sizes[0]).toEqual({ value: "14", label: "14 AWG (2.08 mm²)" });
    expect(sizes.at(-1)!.value).toBe("2000");
    expect(nom001Sede2012.options("norm:installationMethods")!.map((o) => o.value)).toEqual([
      "conduit-pvc",
      "conduit-aluminio",
      "conduit-acero",
      "enterrado",
      "aire-libre",
    ]);
  });

  it("con sus valores por defecto, un cable nuevo queda sin errores de parámetros", () => {
    const cable = createDefaultRegistry().get("cable");
    const params = { ...defaultParams(cable), ...nom001Sede2012.paramDefaults("cable") };
    const issues = validateParams(cable, params, (p) => nom001Sede2012.options(p)?.map((o) => o.value));
    expect(issues).toEqual([]);
  });
});
