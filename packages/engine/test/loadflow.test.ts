import { addElement, connect, createDefaultRegistry, createProject, updateParams, type ParamValue, type Project } from "@rea/core";
import { describe, expect, it } from "vitest";
import { runLoadFlow, type NormModule } from "../src";

const registry = createDefaultRegistry();

/** Norma de prueba: impedancia fija de 1 Ω/km de R y 0.5 Ω/km de X; motores con 10 A. */
const R_KM = 1;
const X_KM = 0.5;
const stubNorm: NormModule = {
  id: "prueba",
  edition: "1",
  label: "Norma de prueba",
  available: true,
  options: () => undefined,
  paramDefaults: () => ({}),
  voltageDrop: {
    branch: { pct: 3, mandatory: false, source: "prueba derivado" },
    feeder: { pct: 3, mandatory: false, source: "prueba alimentador" },
    total: { pct: 5, mandatory: false, source: "prueba total" },
    special: [
      { id: "electronico-sensible", label: "Sensible", branch: { pct: 1.5, mandatory: true, source: "647" }, total: { pct: 2.5, mandatory: true, source: "647" } },
      { id: "bomba-contra-incendio", label: "Bomba", motorRunning: { pct: 5, atCurrentPctOfFlc: 115, mandatory: true, source: "695-7(b)" }, motorStarting: { pct: 15, mandatory: true, source: "695-7(a)" } },
    ],
  },
  calc: {
    motorFlc: () => ({ ok: true, amps: 10, tableVoltageV: 460, hp: "5", refs: ["tabla de prueba"], notes: [] }),
    conductorImpedance: () => ({ ok: true, rOhmPerKm: R_KM, xOhmPerKm: X_KM, column: "prueba", temperatureC: 75, refs: [], notes: [] }),
  },
};

class Net {
  p: Project = createProject({ name: "prueba" });
  ids: Record<string, string> = {};
  add(tag: string, type: string, params: Record<string, ParamValue> = {}): this {
    const r = addElement(this.p, registry, type, { tag, params });
    this.p = r.project;
    this.ids[tag] = r.elementId;
    return this;
  }
  wire(a: string, b: string): this {
    const [ea, pa] = a.split(".");
    const [eb, pb] = b.split(".");
    this.p = connect(this.p, registry, { elementId: this.ids[ea!]!, portId: pa! }, { elementId: this.ids[eb!]!, portId: pb! }).project;
    return this;
  }
  set(tag: string, params: Record<string, ParamValue>): this {
    this.p = updateParams(this.p, this.ids[tag]!, params);
    return this;
  }
  run(mode: "nominal" | "barrido" = "barrido", norm: NormModule = stubNorm) {
    const r = runLoadFlow(this.p, registry, norm, { mode });
    return { r, f: (tag: string) => r.elements.get(this.ids[tag]!)!, codes: r.issues.map((i) => `${i.code}:${i.severity}`) };
  }
}

/** Acometida 480 V → tablero → cable de L m → carga trifásica genérica de P kW, FP. */
function line(lengthM: number, pKW: number, pf: number): Net {
  return new Net()
    .add("ACOM", "utility", { voltageV: 480, system: "3F4H" })
    .add("TAB", "panelboard", { voltageV: 480, system: "3F4H" })
    .add("AL", "cable", { forcedSize: "x", lengthM, installationMethod: "x", insulationType: "x" })
    .add("CG", "generic-load", { power: pKW, powerUnit: "kW", powerFactor: pf, voltageV: 480, system: "3F3H" })
    .wire("ACOM.out", "TAB.bus")
    .wire("TAB.bus", "AL.from")
    .wire("AL.to", "CG.in");
}

describe("barrido iterativo contra solución analítica", () => {
  it("línea con carga de potencia constante: |Vr| coincide con la raíz exacta", () => {
    const L = 0.2; // km
    const pKW = 150;
    const pf = 0.8;
    const { r, f } = line(L * 1000, pKW, pf).run("barrido");
    expect(r.converged).toBe(true);
    // Por fase: Vs = 480/√3, P y Q por fase, Z = (R + jX)·L.
    const vs = 480 / Math.sqrt(3);
    const P = (pKW * 1000) / 3;
    const Q = (P / pf) * Math.sqrt(1 - pf * pf);
    const R = R_KM * L;
    const X = X_KM * L;
    const b = 2 * (P * R + Q * X) - vs * vs;
    const c = (P * P + Q * Q) * (R * R + X * X);
    const vr = Math.sqrt((-b + Math.sqrt(b * b - 4 * c)) / 2);
    expect(f("CG").voltage!.v / Math.sqrt(3)).toBeCloseTo(vr, 6);
    // Pérdidas: 3·|I|²·R.
    const i = Math.hypot(P, Q) / vr;
    expect(f("ACOM").power!.pKW).toBeCloseTo((pKW * 1000 + 3 * i * i * R) / 1000, 6);
  });

  it("el método nominal reproduce la fórmula de la Tabla 9", () => {
    const { f } = line(100, 50, 0.9).run("nominal");
    const I = (50000 / 0.9) / (Math.sqrt(3) * 480);
    const ze = R_KM * 0.9 + X_KM * Math.sqrt(1 - 0.81);
    const pct = ((I * ze * 0.1) / (480 / Math.sqrt(3))) * 100;
    expect(f("AL").currentA).toBeCloseTo(I, 9);
    expect(f("AL").dropPct).toBeCloseTo(pct, 9);
  });
});

describe("verificación de criterios", () => {
  it("caída por tramo mayor al límite del proyecto: error con su fuente", () => {
    const { r, codes } = line(400, 100, 0.9).run("nominal");
    expect(codes).toContain("caida-tramo:error");
    expect(r.issues.find((i) => i.code === "caida-tramo")!.message).toContain("prueba derivado");
  });

  it("carga sensible: límite obligatorio de 1.5 % en el derivado", () => {
    // 60 kW a 62 m: caída ≈ 2 %, permitida en general (3 %) pero no para equipo sensible (1.5 %).
    const n = line(62, 60, 0.9).set("CG", { sensitiveElectronic: true });
    const { r, f } = n.run("nominal");
    expect(f("AL").dropPct!).toBeGreaterThan(1.5);
    expect(f("AL").dropPct!).toBeLessThan(3);
    expect(r.issues.some((i) => i.code === "caida-tramo" && i.message.includes("647"))).toBe(true);
  });

  it("bomba contra incendio: verificación en operación al 115 % y aviso de arranque pendiente", () => {
    const n = new Net()
      .add("ACOM", "utility", { voltageV: 480, system: "3F4H", operatingVoltagePu: 0.97 })
      .add("TAB", "panelboard", { voltageV: 480, system: "3F4H" })
      .add("AL", "cable", { forcedSize: "x", lengthM: 50, installationMethod: "x", insulationType: "x" })
      .add("BCI", "motor", { voltageV: 460, firePump: true })
      .wire("ACOM.out", "TAB.bus")
      .wire("TAB.bus", "AL.from")
      .wire("AL.to", "BCI.in");
    const { codes } = n.run("nominal");
    expect(codes).toContain("bomba-contra-incendio:info");
  });

  it("transformador sin X/R: error explícito (no se inventa el dato)", () => {
    const n = new Net()
      .add("ACOM", "utility")
      .add("TR", "transformer", { xrSource: "placa", xrRatio: null })
      .add("TAB", "panelboard")
      .wire("ACOM.out", "TR.primary")
      .wire("TR.secondary", "TAB.bus");
    expect(n.run().codes).toContain("transformador-xr:error");
  });

  it("transformador: %R por pérdidas en carga de placa y por valor típico de la norma", () => {
    const tr = (params: Record<string, ParamValue>, norm = stubNorm) => {
      const n = new Net()
        .add("ACOM", "utility")
        .add("TR", "transformer", { ratedKVA: 500, impedancePct: 5.75, ...params })
        .add("TAB", "panelboard")
        .wire("ACOM.out", "TR.primary")
        .wire("TR.secondary", "TAB.bus");
      return n.run("barrido", norm);
    };
    // 4 600 W en 500 kVA: %R = 4 600 / 5 000 = 0.92 %; %X = √(5.75² − 0.92²).
    const placa = tr({ xrSource: "perdidas", loadLossesW: 4600 });
    expect(placa.codes).toEqual([]);
    const trace = placa.f("TR").traces.find((t) => t.title.includes("impedancia del transformador"))!;
    expect(trace.steps.map((s) => s.result).join(" ")).toContain("%R = 0.92");
    // Sin consulta de valores típicos en la norma: error que pide el dato.
    expect(tr({ xrSource: "tipico" }).codes).toContain("transformador-xr:error");
    // Con valores típicos: advertencia de dato aproximado, no error.
    const typical: NormModule = { ...stubNorm, calc: { ...stubNorm.calc!, transformerLoadLosses: () => ({ ok: true, lossW: 4600, tableKVA: 500, column: "prueba", substitution: "prueba", refs: ["tabla de pérdidas de prueba"], notes: [], warnings: ["valor típico"] }) } };
    expect(tr({ xrSource: "tipico" }, typical).codes).toEqual(["dato-aproximado:warning"]);
    // Pérdidas incongruentes con %Z: error.
    expect(tr({ xrSource: "perdidas", loadLossesW: 40000 }).codes).toContain("transformador-xr:error");
  });

  it("cable sin calibre: advertencia, el cálculo continúa", () => {
    const { r, codes } = line(50, 10, 0.9).set("AL", { forcedSize: null }).run();
    expect(codes).toEqual(["sin-calibre:warning"]);
    expect(r.calculated).toBe(true);
  });

  it("errores de topología bloquean el cálculo", () => {
    const n = line(50, 10, 0.9).add("GE", "generator", { voltageV: 480, system: "3F4H" }).wire("GE.out", "TAB.bus");
    const { r } = n.run();
    expect(r.calculated).toBe(false);
    expect(r.issues[0]!.message).toMatch(/^No se puede calcular: Fuentes en paralelo/);
  });
});
