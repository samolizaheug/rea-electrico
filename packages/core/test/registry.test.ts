import { describe, expect, it } from "vitest";
import {
  ElementRegistry,
  builtInElementTypes,
  createDefaultRegistry,
  defaultParams,
  validateParams,
  type ElementTypeDefinition,
} from "../src";

describe("biblioteca estándar", () => {
  const registry = createDefaultRegistry();

  it("incluye todos los elementos del alcance de la fase 1", () => {
    const types = registry.list().map((d) => d.type).sort();
    expect(types).toEqual(
      [
        "utility", "generator", "ups",
        "transformer",
        "panelboard", "mcc", "busbar", "breaker", "ats", "cable", "cable-mt",
        "motor", "vfd", "receptacle", "luminaire", "generic-load", "grouped-load",
      ].sort(),
    );
  });

  it("cada tipo tiene símbolo ANSI e IEC y comportamiento de cálculo", () => {
    for (const def of builtInElementTypes) {
      expect(def.symbols.ANSI, def.type).toMatch(/^ansi\//);
      expect(def.symbols.IEC, def.type).toMatch(/^iec\//);
      expect(def.calcBehavior, def.type).not.toBe("");
    }
  });

  it("los valores por defecto solo fallan en datos obligatorios que dependen de la norma", () => {
    for (const def of builtInElementTypes) {
      const errors = validateParams(def, defaultParams(def)).filter((i) => i.severity === "error");
      // insulationType e installationMethod los provee el módulo normativo, por eso inician vacíos.
      expect(errors.map((e) => e.key), def.type).toEqual(
        def.type === "cable" ? ["insulationType", "installationMethod"] : [],
      );
    }
  });

  it("valida enums con proveedor cuando se da el resolvedor", () => {
    const cable = registry.get("cable");
    const params = { ...defaultParams(cable), insulationType: "XYZ", installationMethod: "conduit-pvc" };
    const issues = validateParams(cable, params, (provider) =>
      provider === "norm:insulationTypes" ? ["THHW-LS", "THWN-2"] : provider === "norm:installationMethods" ? ["conduit-pvc"] : undefined,
    );
    expect(issues.filter((i) => i.severity === "error").map((i) => i.key)).toEqual(["insulationType"]);
  });

  it("ignora parámetros que no aplican (visibleWhen)", () => {
    const motor = registry.get("motor");
    // Motor trifásico: la fase de conexión no aplica aunque esté vacía.
    const params = { ...defaultParams(motor), phase: null };
    expect(validateParams(motor, params).filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("extensibilidad del registro", () => {
  const capacitor: ElementTypeDefinition = {
    type: "capacitor-bank",
    name: "Banco de capacitores",
    category: "carga",
    electricalRole: "load",
    ports: [{ id: "in", label: "Alimentación", side: "top" }],
    tag: { prefix: "BC", style: "number" },
    symbols: { ANSI: "ansi/capacitor", IEC: "iec/capacitor" },
    calcBehavior: "load.capacitor",
    params: [{ key: "ratedKvar", label: "Potencia reactiva", kind: "number", default: 50, min: 0, minExclusive: true, required: true }],
  };

  it("acepta un tipo nuevo bien formado", () => {
    const r = createDefaultRegistry().register(capacitor);
    expect(r.get("capacitor-bank").name).toBe("Banco de capacitores");
  });

  it("rechaza tipos duplicados o mal formados", () => {
    const r = new ElementRegistry().register(capacitor);
    expect(() => r.register(capacitor)).toThrow(/ya está registrado/);
    expect(() => new ElementRegistry().register({ ...capacitor, type: "Banco Cap" })).toThrow(/kebab-case/);
    expect(() =>
      new ElementRegistry().register({ ...capacitor, params: [{ key: "x", label: "X", kind: "number", default: -1, min: 0 }] }),
    ).toThrow(/por defecto inválidos/);
    expect(() =>
      new ElementRegistry().register({
        ...capacitor,
        params: [{ key: "x", label: "X", kind: "number", visibleWhen: { param: "nada", equals: 1 } }],
      }),
    ).toThrow(/inexistente/);
  });
});
