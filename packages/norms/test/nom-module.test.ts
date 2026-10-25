import { createDefaultRegistry, defaultParams, validateParams } from "@rea/core";
import { describe, expect, it } from "vitest";
import { RACEWAY_METHODS, getNormModule, nom001Sede2012, normModules } from "../src";

const opts = (provider: string, params?: Record<string, string>) => nom001Sede2012.options(provider, params)!;

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

  it("ofrece aislamientos de la Tabla 310-104(a) y calibres de 14 AWG a 2000 kcmil", () => {
    const ins = opts("norm:insulationTypes");
    expect(ins.map((o) => o.value)).toEqual(expect.arrayContaining(["THHW-LS", "THWN-2", "XHHW-2", "TW"]));
    expect(ins.find((o) => o.value === "THW")!.label).toBe("THW (75 °C mojados)");
    const sizes = opts("norm:conductorSizes");
    expect(sizes[0]).toEqual({ value: "14", label: "14 AWG (2.08 mm²)" });
    expect(sizes.at(-1)!.value).toBe("2000");
  });

  it("métodos de instalación: conduit PVC, acero galvanizado, aluminio, inoxidable, flexibles, ducto, charola, enterrado y aire libre", () => {
    const groups = [...new Set(opts("norm:installationMethods").map((o) => o.group))];
    expect(groups).toEqual([
      "Tubo conduit no metálico",
      "Tubo conduit de acero galvanizado",
      "Tubo conduit de aluminio",
      "Tubo conduit de acero inoxidable",
      "Tubo conduit flexible",
      "Ductos",
      "Charolas portacables",
      "Instalaciones enterradas",
      "Al aire libre",
    ]);
    // Todo supuesto no cubierto por la norma queda declarado.
    for (const m of RACEWAY_METHODS) {
      if (["conduit-rmc-inox", "ducto-metalico", "charola-escalera", "charola-fondo-solido", "enterrado-directo", "aire-libre"].includes(m.value)) {
        expect(m.impedanceAssumption, m.value).toMatch(/Supuesto aprobado por el usuario/);
      }
    }
  });

  it("las medidas dependen del método: Tabla 4 para tubo, Tabla 392-22(a) para charola, catálogo para ducto", () => {
    const pvc = opts("norm:racewaySizes", { installationMethod: "conduit-pvc-40" });
    expect(pvc[0]).toEqual({ value: "16", label: '16 (1/2") — Ø int. 15.3 mm' });
    expect(pvc.at(-1)!.value).toBe("155");
    const emt = opts("norm:racewaySizes", { installationMethod: "conduit-emt-acero" });
    expect(emt.map((o) => o.value)).toEqual(["16", "21", "27", "35", "41", "53", "63", "78", "91", "103"]);
    const rmc = opts("norm:racewaySizes", { installationMethod: "conduit-rmc-inox" });
    expect(rmc.find((o) => o.value === "53")!.label).toBe('53 (2") — Ø int. 52.9 mm');
    expect(opts("norm:racewaySizes", { installationMethod: "charola-escalera" }).map((o) => o.value)).toEqual(
      ["5", "10", "15", "20", "22.5", "30", "40", "45", "50", "60", "75", "90"],
    );
    expect(opts("norm:racewaySizes", { installationMethod: "ducto-metalico" }).map((o) => o.value)).toEqual(["65x65", "100x100", "150x150"]);
    expect(opts("norm:racewaySizes", { installationMethod: "enterrado-directo" })).toEqual([]);
  });

  it("criterios de caída de tensión de la NOM, con su fuente", () => {
    const vd = nom001Sede2012.voltageDrop!;
    expect([vd.branch.pct, vd.feeder.pct, vd.total.pct]).toEqual([3, 3, 5]);
    expect(vd.branch.mandatory).toBe(false);
    const sensible = vd.special.find((s) => s.id === "electronico-sensible")!;
    expect([sensible.branch!.pct, sensible.total!.pct, sensible.branch!.mandatory]).toEqual([1.5, 2.5, true]);
    const bomba = vd.special.find((s) => s.id === "bomba-contra-incendio")!;
    expect(bomba.motorRunning).toMatchObject({ pct: 5, atCurrentPctOfFlc: 115, source: "NOM-001-SEDE-2012 695-7(b)" });
    expect(bomba.motorStarting!.pct).toBe(15);
  });

  it("con sus valores por defecto, un cable nuevo queda sin errores de parámetros", () => {
    const cable = createDefaultRegistry().get("cable");
    const params = { ...defaultParams(cable), ...nom001Sede2012.paramDefaults("cable") };
    const issues = validateParams(cable, params, (p, ps) => nom001Sede2012.options(p, ps)?.map((o) => o.value));
    expect(issues).toEqual([]);
    const withSize = { ...params, racewaySize: "27" };
    expect(validateParams(cable, withSize, (p, ps) => nom001Sede2012.options(p, ps)?.map((o) => o.value))).toEqual([]);
  });
});
