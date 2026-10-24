import { describe, expect, it } from "vitest";
import {
  ModelError,
  addElement,
  connect,
  connectionsAt,
  createDefaultRegistry,
  createProject,
  disconnect,
  duplicateElements,
  duplicateProject,
  extractClip,
  pasteClip,
  removeElements,
  rotateElements,
  updateMeta,
  updateSettings,
  renumberTags,
  setTag,
  updateParams,
  type Project,
} from "../src";

const registry = createDefaultRegistry();

function add(p: Project, type: string, x = 0, y = 0) {
  return addElement(p, registry, type, { position: { x, y } });
}

describe("proyecto", () => {
  it("se crea con la configuración por defecto (NOM-001-SEDE-2012, ANSI, mm², m, 60 Hz)", () => {
    const p = createProject({ name: "Planta" });
    expect(p.settings.norm).toEqual({ id: "nom-001-sede", edition: "2012" });
    expect(p.settings.symbology).toBe("ANSI");
    expect(p.settings.units).toEqual({ conductorSize: "mm2", length: "m" });
    expect(p.settings.voltageDrop).toEqual({ branchPct: 3, feederPct: 3, totalPct: 5 });
    expect(p.elements).toEqual([]);
  });

  it("agrega elementos con parámetros por defecto, etiqueta y posición", () => {
    let p = createProject({ name: "P" });
    const a = add(p, "transformer", 100, 200);
    p = a.project;
    const tr = p.elements[0]!;
    expect(tr.tag).toBe("TR-1");
    expect(tr.tagLocked).toBe(false);
    expect(tr.params.ratedKVA).toBe(500);
    expect(p.diagram.nodes[a.elementId]).toEqual({ x: 100, y: 200, rotation: 0 });
    p = add(p, "transformer").project;
    p = add(p, "panelboard").project;
    p = add(p, "motor").project;
    expect(p.elements.map((e) => e.tag)).toEqual(["TR-1", "TR-2", "TAB-A", "M-01"]);
  });

  it("las operaciones no modifican el proyecto original", () => {
    const p0 = createProject({ name: "P" });
    const p1 = add(p0, "motor").project;
    expect(p0.elements).toHaveLength(0);
    expect(p1.elements).toHaveLength(1);
  });

  it("conecta respetando la capacidad de cada puerto", () => {
    let p = createProject({ name: "P" });
    const tr = add(p, "transformer");
    p = tr.project;
    const tab = add(p, "panelboard");
    p = tab.project;
    const m1 = add(p, "motor");
    p = m1.project;
    const m2 = add(p, "motor");
    p = m2.project;

    p = connect(p, registry, { elementId: tr.elementId, portId: "secondary" }, { elementId: tab.elementId, portId: "bus" }).project;
    // La barra del tablero admite conexiones ilimitadas.
    p = connect(p, registry, { elementId: tab.elementId, portId: "bus" }, { elementId: m1.elementId, portId: "in" }).project;
    p = connect(p, registry, { elementId: tab.elementId, portId: "bus" }, { elementId: m2.elementId, portId: "in" }).project;
    expect(connectionsAt(p, { elementId: tab.elementId, portId: "bus" })).toHaveLength(3);

    // El secundario del transformador solo admite una.
    expect(() =>
      connect(p, registry, { elementId: tr.elementId, portId: "secondary" }, { elementId: m1.elementId, portId: "in" }),
    ).toThrow(ModelError);
    expect(() => connect(p, registry, { elementId: tr.elementId, portId: "nope" }, { elementId: tab.elementId, portId: "bus" })).toThrow(
      /no tiene el puerto/,
    );
    expect(() => connect(p, registry, { elementId: tab.elementId, portId: "bus" }, { elementId: tab.elementId, portId: "bus" })).toThrow(
      /consigo mismo/,
    );
  });

  it("eliminar un elemento elimina sus conexiones y su posición", () => {
    let p = createProject({ name: "P" });
    const tab = add(p, "panelboard");
    p = tab.project;
    const m = add(p, "motor");
    p = m.project;
    const c = connect(p, registry, { elementId: tab.elementId, portId: "bus" }, { elementId: m.elementId, portId: "in" });
    p = removeElements(c.project, [m.elementId]);
    expect(p.elements.map((e) => e.tag)).toEqual(["TAB-A"]);
    expect(p.connections).toEqual([]);
    expect(p.diagram.wires[c.connectionId]).toBeUndefined();
    expect(p.diagram.nodes[m.elementId]).toBeUndefined();
  });

  it("desconecta", () => {
    let p = createProject({ name: "P" });
    const tab = add(p, "panelboard");
    const m = add(tab.project, "motor");
    const c = connect(m.project, registry, { elementId: tab.elementId, portId: "bus" }, { elementId: m.elementId, portId: "in" });
    p = disconnect(c.project, c.connectionId);
    expect(p.connections).toEqual([]);
  });

  it("etiquetas editables, únicas y respetadas al renumerar", () => {
    let p = createProject({ name: "P" });
    const t1 = add(p, "panelboard");
    p = t1.project;
    const t2 = add(p, "panelboard");
    p = t2.project;
    p = setTag(p, t1.elementId, "TAB-GENERAL");
    expect(() => setTag(p, t2.elementId, "TAB-GENERAL")).toThrow(/ya está en uso/);
    p = renumberTags(p, registry);
    expect(p.elements.map((e) => e.tag)).toEqual(["TAB-GENERAL", "TAB-A"]);
  });

  it("actualiza parámetros", () => {
    const a = add(createProject({ name: "P" }), "motor");
    const p = updateParams(a.project, a.elementId, { ratedPower: 25 });
    expect(p.elements[0]!.params.ratedPower).toBe(25);
    expect(p.elements[0]!.params.voltageV).toBe(220);
  });

  it("copia elementos conservando sus conexiones internas", () => {
    let p = createProject({ name: "P" });
    const tab = add(p, "panelboard", 0, 0);
    p = tab.project;
    const cb = add(p, "cable", 0, 100);
    p = cb.project;
    const m = add(p, "motor", 0, 200);
    p = m.project;
    p = updateParams(p, m.elementId, { ratedPower: 15 });
    p = connect(p, registry, { elementId: tab.elementId, portId: "bus" }, { elementId: cb.elementId, portId: "from" }).project;
    p = connect(p, registry, { elementId: cb.elementId, portId: "to" }, { elementId: m.elementId, portId: "in" }).project;

    const dup = duplicateElements(p, registry, [cb.elementId, m.elementId], { x: 50, y: 0 });
    const q = dup.project;
    expect(q.elements.map((e) => e.tag)).toEqual(["TAB-A", "AL-1", "M-01", "AL-2", "M-02"]);
    const newMotor = q.elements.find((e) => e.id === dup.idMap[m.elementId])!;
    expect(newMotor.params.ratedPower).toBe(15);
    expect(q.diagram.nodes[newMotor.id]).toEqual({ x: 50, y: 200, rotation: 0 });
    // Se copia la conexión cable→motor, no la del tablero (que no se copió).
    expect(q.connections).toHaveLength(3);
  });

  it("copiar y pegar funciona aunque los originales se hayan eliminado", () => {
    let p = createProject({ name: "P" });
    const tr = add(p, "transformer", 0, 0);
    p = tr.project;
    p = rotateElements(p, [tr.elementId]);
    const clip = extractClip(p, [tr.elementId]);
    p = removeElements(p, [tr.elementId]);
    const pasted = pasteClip(p, registry, clip, { x: 20, y: 0 });
    const id = pasted.idMap[tr.elementId]!;
    expect(pasted.project.elements.map((e) => e.tag)).toEqual(["TR-1"]);
    expect(pasted.project.diagram.nodes[id]).toEqual({ x: 20, y: 0, rotation: 90 });
  });

  it("gira, cambia la simbología y renombra sin alterar el modelo eléctrico", () => {
    const a = add(createProject({ name: "P" }), "motor");
    let p = rotateElements(a.project, [a.elementId], 270);
    p = rotateElements(p, [a.elementId], 180);
    expect(p.diagram.nodes[a.elementId]!.rotation).toBe(90);
    const q = updateMeta(updateSettings(p, { symbology: "IEC" }), { name: "Nuevo nombre" });
    expect(q.settings.symbology).toBe("IEC");
    expect(q.meta.name).toBe("Nuevo nombre");
    expect(q.elements).toBe(p.elements);
    expect(q.connections).toBe(p.connections);
  });

  it("duplica el proyecto con identidad nueva", () => {
    const p = add(createProject({ name: "Hospital" }), "motor").project;
    const d = duplicateProject(p);
    expect(d.meta.name).toBe("Hospital (copia)");
    expect(d.meta.id).not.toBe(p.meta.id);
    expect(d.elements).toEqual(p.elements);
    expect(d.elements).not.toBe(p.elements);
  });
});
