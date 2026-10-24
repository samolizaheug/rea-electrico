import { describe, expect, it } from "vitest";
import {
  ProjectFormatError,
  addElement,
  connect,
  createDefaultRegistry,
  createProject,
  parseProject,
  serializeProject,
  updateParams,
  type Project,
} from "../src";

const registry = createDefaultRegistry();

function sample(): Project {
  let p = createProject({ name: "Ejemplo", client: "Cliente", location: "Monterrey, N.L." });
  const acom = addElement(p, registry, "utility");
  p = acom.project;
  const tr = addElement(p, registry, "transformer");
  p = tr.project;
  const tab = addElement(p, registry, "panelboard");
  p = tab.project;
  p = connect(p, registry, { elementId: acom.elementId, portId: "out" }, { elementId: tr.elementId, portId: "primary" }).project;
  p = connect(p, registry, { elementId: tr.elementId, portId: "secondary" }, { elementId: tab.elementId, portId: "bus" }).project;
  return p;
}

describe("formato de archivo", () => {
  it("ida y vuelta sin pérdida", () => {
    const p = sample();
    const { project, issues } = parseProject(serializeProject(p), registry);
    expect(project).toEqual(p);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("rechaza archivos que no son proyectos", () => {
    expect(() => parseProject("no es json")).toThrow(ProjectFormatError);
    expect(() => parseProject(JSON.stringify({ hola: 1 }))).toThrow(/no es un proyecto/);
  });

  it("rechaza versiones de esquema futuras", () => {
    const doc = { ...sample(), schemaVersion: 99 };
    expect(() => parseProject(JSON.stringify(doc))).toThrow(/más nueva/);
  });

  it("reporta errores de estructura con su ruta", () => {
    const doc = sample() as unknown as { settings: { symbology: string } };
    doc.settings.symbology = "DIN";
    try {
      parseProject(JSON.stringify(doc));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ProjectFormatError);
      expect((e as ProjectFormatError).issues[0]!.path).toBe("settings.symbology");
    }
  });

  it("detecta problemas semánticos: tipo desconocido, puerto inválido, parámetro fuera de rango", () => {
    let p = sample();
    p = updateParams(p, p.elements[1]!.id, { impedancePct: -1 });
    const doc = structuredClone(p);
    doc.elements[0]!.type = "reactor-nuclear";
    doc.connections[1]!.b.portId = "inexistente";
    const { issues } = parseProject(JSON.stringify(doc), registry);
    const messages = issues.filter((i) => i.severity === "error").map((i) => i.message);
    expect(messages.some((m) => m.includes("desconocido"))).toBe(true);
    expect(messages.some((m) => m.includes('no tiene el puerto "inexistente"'))).toBe(true);
    expect(messages.some((m) => m.startsWith("TR-1: Impedancia %Z"))).toBe(true);
  });
});
