import { addElement, connect, createDefaultRegistry, createProject, type ParamValue, type Project } from "@rea/core";

/**
 * Sistema de ejemplo de la fase 1 (documento: docs/ejemplos/sistema-ejemplo.md).
 *
 * Acometida 23 kV → TR-1 750 kVA 23 000/480Y-277 V → TG 480 V
 *   ├─ AL-1 → CCM-1: M-01 50 hp, VFD-01 + M-02 25 hp, M-03 10 hp (460 V)
 *   ├─ AL-2 → TR-2 75 kVA 480/220Y-127 V → AL-3 → TAB-A: L-01 (127 V, fase A), C-01 (127 V, fase B), CG-01 15 kW 220 V
 *   └─ AL-4 → TAB-B 480Y/277 V: L-02 (277 V, fase A), CA-01 40 kVA 480 V
 *
 * Los calibres se fijan en el ejemplo (la selección automática es de la etapa E6).
 */
export function sistemaEjemplo(): Project {
  const registry = createDefaultRegistry();
  let p = createProject({
    name: "Sistema de ejemplo fase 1",
    client: "Ejemplo",
    location: "México",
    author: "Ing. RGLR",
    description: "Sistema resuelto a mano para verificar el motor de cálculo (docs/ejemplos/sistema-ejemplo.md).",
  });
  const ids: Record<string, string> = {};
  const add = (tag: string, type: string, x: number, y: number, params: Record<string, ParamValue> = {}) => {
    const r = addElement(p, registry, type, { tag, position: { x, y }, params });
    p = r.project;
    ids[tag] = r.elementId;
  };
  const wire = (a: string, b: string) => {
    const [ea, pa] = a.split(".") as [string, string];
    const [eb, pb] = b.split(".") as [string, string];
    p = connect(p, registry, { elementId: ids[ea]!, portId: pa }, { elementId: ids[eb]!, portId: pb }).project;
  };
  const cable = (tag: string, x: number, y: number, size: string, lengthM: number, method: string) =>
    add(tag, "cable", x, y, { forcedSize: size, lengthM, installationMethod: method, insulationType: "THHW-LS", material: "Cu" });
  const motor = (tag: string, x: number, y: number, hp: number) =>
    add(tag, "motor", x, y, { ratedPower: hp, ratedPowerUnit: "hp", voltageV: 460, system: "3F3H", powerFactor: 0.85, currentSource: "tabla" });

  // Fuente y transformador principal.
  add("ACOM-1", "utility", 580, 0, { voltageV: 23000, system: "3F3H", operatingVoltagePu: 1 });
  add("TR-1", "transformer", 580, 100, { ratedKVA: 750, primaryVoltageV: 23000, primarySystem: "3F3H", secondaryVoltageV: 480, system: "3F4H", connection: "Dyn1", impedancePct: 5.75, xrRatio: 6, tapPct: 0 });
  add("TG", "panelboard", 520, 240, { voltageV: 480, system: "3F4H", boardUse: "distribucion" });
  wire("ACOM-1.out", "TR-1.primary");
  wire("TR-1.secondary", "TG.bus");

  // Alimentador al CCM.
  add("INT-1", "breaker", 300, 320);
  cable("AL-1", 300, 420, "2/0", 40, "conduit-rmc-acero");
  add("CCM-1", "mcc", 220, 540, { voltageV: 480, system: "3F3H" });
  wire("TG.bus", "INT-1.line");
  wire("INT-1.load", "AL-1.from");
  wire("AL-1.to", "CCM-1.bus");
  add("INT-11", "breaker", 180, 620);
  cable("AL-11", 180, 720, "4", 25, "conduit-rmc-acero");
  motor("M-01", 180, 840, 50);
  add("INT-12", "breaker", 300, 620);
  cable("AL-12", 300, 720, "8", 30, "conduit-rmc-acero");
  add("VFD-01", "vfd", 300, 840, { inputVoltageV: 480, efficiencyPct: 97, inputPowerFactor: 0.95 });
  motor("M-02", 300, 960, 25);
  add("INT-13", "breaker", 420, 620);
  cable("AL-13", 420, 720, "12", 30, "conduit-rmc-acero");
  motor("M-03", 420, 840, 10);
  for (const [i, c, l] of [["INT-11", "AL-11", "M-01"], ["INT-12", "AL-12", "VFD-01"], ["INT-13", "AL-13", "M-03"]] as const) {
    wire("CCM-1.bus", `${i}.line`);
    wire(`${i}.load`, `${c}.from`);
    wire(`${c}.to`, `${l}.in`);
  }
  wire("VFD-01.out", "M-02.in");

  // Alimentador al TR-2 y TAB-A.
  add("INT-2", "breaker", 600, 320);
  cable("AL-2", 600, 420, "2", 20, "conduit-emt-acero");
  add("TR-2", "transformer", 600, 520, { ratedKVA: 75, primaryVoltageV: 480, primarySystem: "3F3H", secondaryVoltageV: 220, system: "3F4H", connection: "Dyn1", impedancePct: 4, xrRatio: 2, tapPct: 0 });
  cable("AL-3", 600, 640, "250", 10, "conduit-pvc-40");
  add("TAB-A", "panelboard", 540, 760, { voltageV: 220, system: "3F4H", boardUse: "alumbrado-contactos" });
  wire("TG.bus", "INT-2.line");
  wire("INT-2.load", "AL-2.from");
  wire("AL-2.to", "TR-2.primary");
  wire("TR-2.secondary", "AL-3.from");
  wire("AL-3.to", "TAB-A.bus");
  add("INT-21", "breaker", 520, 840);
  cable("AL-21", 520, 940, "12", 30, "conduit-pvc-40");
  add("L-01", "luminaire", 520, 1060, { quantity: 20, wattsPerUnit: 50, powerFactor: 0.9, voltageV: 127, system: "1F2H", phase: "A" });
  add("INT-22", "breaker", 620, 840);
  cable("AL-22", 620, 940, "12", 25, "conduit-pvc-40");
  add("C-01", "receptacle", 620, 1060, { quantity: 8, vaPerOutlet: 180, powerFactor: 0.9, voltageV: 127, system: "1F2H", phase: "B" });
  add("INT-23", "breaker", 720, 840);
  cable("AL-23", 720, 940, "6", 40, "conduit-pvc-40");
  add("CG-01", "generic-load", 720, 1060, { power: 15, powerUnit: "kW", powerFactor: 0.9, voltageV: 220, system: "3F3H" });
  for (const [i, c, l] of [["INT-21", "AL-21", "L-01"], ["INT-22", "AL-22", "C-01"], ["INT-23", "AL-23", "CG-01"]] as const) {
    wire("TAB-A.bus", `${i}.line`);
    wire(`${i}.load`, `${c}.from`);
    wire(`${c}.to`, `${l}.in`);
  }

  // Alimentador a TAB-B.
  add("INT-4", "breaker", 860, 320);
  cable("AL-4", 860, 420, "4", 50, "conduit-pvc-40");
  add("TAB-B", "panelboard", 800, 540, { voltageV: 480, system: "3F4H", boardUse: "alumbrado-contactos" });
  wire("TG.bus", "INT-4.line");
  wire("INT-4.load", "AL-4.from");
  wire("AL-4.to", "TAB-B.bus");
  add("INT-41", "breaker", 840, 620);
  cable("AL-41", 840, 720, "12", 40, "conduit-pvc-40");
  add("L-02", "luminaire", 840, 840, { quantity: 30, wattsPerUnit: 100, powerFactor: 0.9, voltageV: 277, system: "1F2H", phase: "A" });
  add("INT-42", "breaker", 960, 620);
  cable("AL-42", 960, 720, "6", 20, "conduit-pvc-40");
  add("CA-01", "grouped-load", 940, 840, { description: "Equipos de proceso", power: 40, powerUnit: "kVA", powerFactor: 0.9, voltageV: 480, system: "3F3H" });
  for (const [i, c, l] of [["INT-41", "AL-41", "L-02"], ["INT-42", "AL-42", "CA-01"]] as const) {
    wire("TAB-B.bus", `${i}.line`);
    wire(`${i}.load`, `${c}.from`);
    wire(`${c}.to`, `${l}.in`);
  }
  return p;
}
