import { addElement, connect, createDefaultRegistry, createProject, updateParams, type ParamValue, type Project } from "@rea/core";
import { describe, expect, it } from "vitest";
import { validateTopology } from "../src";

const registry = createDefaultRegistry();

/** Constructor de redes de prueba: elementos por etiqueta y conexiones "TAG.puerto". */
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

  check() {
    const r = validateTopology(this.p, registry);
    const tagOf = Object.fromEntries(Object.entries(this.ids).map(([t, id]) => [id, t]));
    return {
      report: r,
      codes: r.issues.map((i) => `${i.code}:${i.elementIds.map((id) => tagOf[id]).join("+")}`),
    };
  }
}

/** Acometida 23 kV → TR 23 kV/220-127 V → TAB-A con un motor y una luminaria. */
function base(): Net {
  return new Net()
    .add("ACOM", "utility")
    .add("TR", "transformer")
    .add("TAB-A", "panelboard")
    .add("INT-1", "breaker")
    .add("AL-1", "cable")
    .add("M-1", "motor")
    .add("INT-2", "breaker")
    .add("AL-2", "cable")
    .add("L-1", "luminaire")
    .wire("ACOM.out", "TR.primary")
    .wire("TR.secondary", "TAB-A.bus")
    .wire("TAB-A.bus", "INT-1.line")
    .wire("INT-1.load", "AL-1.from")
    .wire("AL-1.to", "M-1.in")
    .wire("TAB-A.bus", "INT-2.line")
    .wire("INT-2.load", "AL-2.from")
    .wire("AL-2.to", "L-1.in");
}

describe("validación de topología", () => {
  it("un sistema radial correcto no tiene observaciones y todo queda energizado por la acometida", () => {
    const n = base();
    const { report, codes } = n.check();
    expect(codes).toEqual([]);
    expect(report.energized.size).toBe(9);
    expect(report.sourceOf.get(n.ids["L-1"]!)).toBe(n.ids.ACOM);
  });

  it("puertos sin conectar: carga y extremo de cable son error; interruptor de reserva es advertencia", () => {
    const n = base().add("M-2", "motor").add("INT-3", "breaker").wire("TAB-A.bus", "INT-3.line");
    expect(n.check().codes).toEqual(["puerto-sin-conectar:M-2", "puerto-sin-conectar:INT-3"]);
    expect(n.check().report.issues.map((i) => i.severity)).toEqual(["error", "warning"]);
  });

  it("interruptor abierto: lo de aguas abajo queda desenergizado (advertencia, no error)", () => {
    const { codes } = base().set("INT-1", { state: "abierto" }).check();
    expect(codes).toEqual(["desenergizado:AL-1", "desenergizado:M-1"]);
  });

  it("sin acometida: todo queda sin fuente", () => {
    const n = new Net().add("TAB", "panelboard").add("INT", "breaker").add("M", "motor").wire("TAB.bus", "INT.line").wire("INT.load", "M.in");
    expect(n.check().codes).toEqual(["sin-fuente:TAB", "sin-fuente:INT", "sin-fuente:M"]);
  });

  it("generador conectado directo a la barra: fuentes en paralelo", () => {
    const n = base().add("GE", "generator", { voltageV: 220, system: "3F4H" }).wire("GE.out", "TAB-A.bus");
    expect(n.check().codes).toContain("fuentes-en-paralelo:ACOM+GE");
  });

  it("con ATS solo una fuente alimenta; en emergencia la carga cambia de fuente", () => {
    const n = new Net()
      .add("ACOM", "utility", { voltageV: 220, system: "3F4H" })
      .add("GE", "generator", { voltageV: 220, system: "3F4H" })
      .add("ATS", "ats")
      .add("TAB", "panelboard")
      .wire("ACOM.out", "ATS.normal")
      .wire("GE.out", "ATS.emergency")
      .wire("ATS.load", "TAB.bus");
    let r = n.check();
    expect(r.codes).toEqual([]);
    expect(r.report.sourceOf.get(n.ids.TAB!)).toBe(n.ids.ACOM);
    r = n.set("ATS", { position: "emergencia" }).check();
    expect(r.codes).toEqual([]);
    expect(r.report.sourceOf.get(n.ids.TAB!)).toBe(n.ids.GE);
  });

  it("dos alimentadores entre los mismos tableros forman un lazo; abrir un interruptor lo rompe", () => {
    const n = base()
      .add("TAB-B", "panelboard")
      .add("INT-3", "breaker")
      .add("AL-3", "cable")
      .add("INT-4", "breaker")
      .add("AL-4", "cable")
      .wire("TAB-A.bus", "INT-3.line")
      .wire("INT-3.load", "AL-3.from")
      .wire("AL-3.to", "TAB-B.bus")
      .wire("TAB-A.bus", "INT-4.line")
      .wire("INT-4.load", "AL-4.from")
      .wire("AL-4.to", "TAB-B.bus");
    expect(n.check().codes).toEqual(["lazo:AL-4"]);
    expect(n.set("INT-4", { state: "abierto" }).check().codes).toEqual([]);
  });

  it("transformador alimentado por el secundario", () => {
    const n = new Net()
      .add("ACOM", "utility", { voltageV: 220, system: "3F4H" })
      .add("TR", "transformer")
      .add("TAB", "panelboard", { voltageV: 23000, system: "3F3H" })
      .wire("ACOM.out", "TR.secondary")
      .wire("TR.primary", "TAB.bus");
    expect(n.check().codes).toEqual(["alimentacion-inversa:TR"]);
  });
});

describe("compatibilidad de tensiones", () => {
  it("tablero de 480 V conectado al secundario de 220 V", () => {
    expect(base().set("TAB-A", { voltageV: 480 }).check().codes).toEqual(["tension-incompatible:TAB-A+TR"]);
  });

  it("tablero de 4 hilos alimentado por un secundario de 3 hilos (y su carga fase-neutro queda sin neutro)", () => {
    expect(base().set("TR", { system: "3F3H" }).check().codes).toEqual(["sistema-incompatible:TAB-A+TR", "sistema-incompatible:L-1"]);
  });

  it("motor de 460 V en sistema de 480 V: dentro de tolerancia (4.2 %)", () => {
    const n = base().set("TR", { secondaryVoltageV: 480 }).set("TAB-A", { voltageV: 480 }).set("M-1", { voltageV: 460 }).set("L-1", { voltageV: 277 });
    expect(n.check().codes).toEqual([]);
  });

  it("luminaria fase-neutro: 127 V correcto; 220 V es error; en sistema sin neutro es error", () => {
    expect(base().set("L-1", { voltageV: 220 }).check().codes).toEqual(["tension-fuera-de-tolerancia:L-1"]);
    const sinNeutro = base().set("TR", { system: "3F3H" }).set("TAB-A", { system: "3F3H" });
    expect(sinNeutro.check().codes).toEqual(["sistema-incompatible:L-1"]);
  });

  it("luminaria entre fases a 220 V es correcta", () => {
    expect(base().set("L-1", { voltageV: 220, phase: "AB" }).check().codes).toEqual([]);
  });

  it("motor monofásico de 115 V en 127 V: advertencia (|115 − 127.0| / 127.0 = 9.5 %)", () => {
    const { report, codes } = base().set("M-1", { voltageV: 115, system: "1F2H", phase: "A" }).check();
    expect(codes).toEqual(["tension-fuera-de-tolerancia:M-1"]);
    expect(report.issues[0]!.severity).toBe("warning");
    expect(report.issues[0]!.message).toContain("entrega 127 V fase-neutro (diferencia 9.5 %)");
  });

  it("carga trifásica en tablero monofásico", () => {
    const n = base().set("TR", { system: "1F3H", secondaryVoltageV: 240 }).set("TAB-A", { system: "1F3H", voltageV: 240 }).set("L-1", { voltageV: 120 });
    expect(n.check().codes).toEqual(["sistema-incompatible:M-1"]);
  });
});
