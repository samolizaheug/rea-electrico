import type { ParamValue } from "../registry/definition";
import { defaultParams } from "../registry/params";
import type { ElementRegistry } from "../registry/registry";
import {
  CURRENT_SCHEMA_VERSION,
  PROJECT_FORMAT,
  type Connection,
  type DiagramNode,
  type PortRef,
  type Project,
  type ProjectElement,
  type ProjectMeta,
  type ProjectSettings,
} from "./schema";
import { nextFreeTag } from "./tags";

/**
 * Operaciones sobre el proyecto. Todas son PURAS: reciben un proyecto y devuelven uno
 * nuevo sin modificar el original. Esto permite deshacer/rehacer y comparar versiones.
 */

export class ModelError extends Error {}

export const DEFAULT_SETTINGS: ProjectSettings = {
  norm: { id: "nom-001-sede", edition: "2012" },
  symbology: "ANSI",
  units: { conductorSize: "mm2", length: "m" },
  language: "es",
  frequencyHz: 60,
  ambient: { airC: 30, groundC: 20 },
  voltageDrop: { branchPct: 3, feederPct: 3, totalPct: 5 },
  phaseUnbalance: { maxPct: 5 },
};

/** Genera un identificador corto, legible y suficientemente único dentro de un proyecto. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface NewProjectInput {
  name: string;
  client?: string;
  location?: string;
  author?: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export function createProject(input: NewProjectInput): Project {
  const now = nowIso();
  const meta: ProjectMeta = {
    id: newId("prj"),
    name: input.name,
    client: input.client ?? "",
    location: input.location ?? "",
    author: input.author ?? "",
    description: input.description ?? "",
    createdAt: now,
    updatedAt: now,
  };
  return {
    format: PROJECT_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    elements: [],
    connections: [],
    diagram: { nodes: {}, wires: {} },
  };
}

/** Copia de un proyecto con identidad nueva ("Guardar como" / duplicar). */
export function duplicateProject(project: Project, newName?: string): Project {
  const now = nowIso();
  return {
    ...structuredClone(project),
    meta: {
      ...project.meta,
      id: newId("prj"),
      name: newName ?? `${project.meta.name} (copia)`,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function touch(project: Project): Project {
  return { ...project, meta: { ...project.meta, updatedAt: nowIso() } };
}

export function getElement(project: Project, elementId: string): ProjectElement {
  const el = project.elements.find((e) => e.id === elementId);
  if (!el) throw new ModelError(`No existe el elemento "${elementId}".`);
  return el;
}

export interface AddElementOptions {
  position?: { x: number; y: number };
  params?: Record<string, ParamValue>;
  tag?: string;
}

/** Agrega un elemento con parámetros por defecto y etiqueta automática. Devuelve el proyecto y el id. */
export function addElement(
  project: Project,
  registry: ElementRegistry,
  type: string,
  options: AddElementOptions = {},
): { project: Project; elementId: string } {
  const def = registry.get(type);
  const existing = new Set(project.elements.map((e) => e.id));
  let elementId = newId("el");
  while (existing.has(elementId)) elementId = newId("el");

  if (options.tag !== undefined) assertTagFree(project, options.tag);
  const tag = options.tag ?? nextFreeTag(project.elements.map((e) => e.tag), def.tag.prefix, def.tag.style);

  const element: ProjectElement = {
    id: elementId,
    type,
    tag,
    tagLocked: options.tag !== undefined,
    params: { ...defaultParams(def), ...options.params },
  };
  const node: DiagramNode = { x: options.position?.x ?? 0, y: options.position?.y ?? 0, rotation: 0 };

  return {
    elementId,
    project: touch({
      ...project,
      elements: [...project.elements, element],
      diagram: { ...project.diagram, nodes: { ...project.diagram.nodes, [elementId]: node } },
    }),
  };
}

/** Elimina elementos y todas sus conexiones. */
export function removeElements(project: Project, elementIds: string[]): Project {
  const gone = new Set(elementIds);
  const keptConnections = project.connections.filter((c) => !gone.has(c.a.elementId) && !gone.has(c.b.elementId));
  const keptIds = new Set(keptConnections.map((c) => c.id));
  const nodes = Object.fromEntries(Object.entries(project.diagram.nodes).filter(([id]) => !gone.has(id)));
  const wires = Object.fromEntries(Object.entries(project.diagram.wires).filter(([id]) => keptIds.has(id)));
  return touch({
    ...project,
    elements: project.elements.filter((e) => !gone.has(e.id)),
    connections: keptConnections,
    diagram: { nodes, wires },
  });
}

/** Actualiza (mezcla) parámetros de un elemento. No valida: la validación es explícita (validateProject). */
export function updateParams(project: Project, elementId: string, changes: Record<string, ParamValue>): Project {
  getElement(project, elementId);
  return touch({
    ...project,
    elements: project.elements.map((e) => (e.id === elementId ? { ...e, params: { ...e.params, ...changes } } : e)),
  });
}

function assertTagFree(project: Project, tag: string, exceptElementId?: string): void {
  const t = tag.trim();
  if (!t) throw new ModelError("La etiqueta no puede estar vacía.");
  if (project.elements.some((e) => e.tag === t && e.id !== exceptElementId)) {
    throw new ModelError(`La etiqueta "${t}" ya está en uso.`);
  }
}

/** Notas libres de un elemento (aparecen en la memoria). Texto vacío elimina la nota. */
export function setNotes(project: Project, elementId: string, notes: string): Project {
  getElement(project, elementId);
  return touch({
    ...project,
    elements: project.elements.map((e) => {
      if (e.id !== elementId) return e;
      const { notes: _old, ...rest } = e;
      return notes.trim() ? { ...rest, notes } : rest;
    }),
  });
}

/** Cambia la etiqueta de un elemento (la marca como editada por el usuario). */
export function setTag(project: Project, elementId: string, tag: string): Project {
  getElement(project, elementId);
  assertTagFree(project, tag, elementId);
  return touch({
    ...project,
    elements: project.elements.map((e) => (e.id === elementId ? { ...e, tag: tag.trim(), tagLocked: true } : e)),
  });
}

/** Conecta dos puertos. Verifica que existan, que no se exceda su capacidad y que no se dupliquen. */
export function connect(
  project: Project,
  registry: ElementRegistry,
  a: PortRef,
  b: PortRef,
): { project: Project; connectionId: string } {
  if (a.elementId === b.elementId) throw new ModelError("No se puede conectar un elemento consigo mismo.");
  for (const ref of [a, b]) {
    const el = getElement(project, ref.elementId);
    const port = registry.get(el.type).ports.find((p) => p.id === ref.portId);
    if (!port) throw new ModelError(`El elemento ${el.tag} no tiene el puerto "${ref.portId}".`);
    const max = port.maxConnections === undefined ? 1 : port.maxConnections;
    if (max !== null && connectionsAt(project, ref).length >= max) {
      throw new ModelError(`El puerto "${port.label}" de ${el.tag} ya está conectado.`);
    }
  }
  const duplicate = project.connections.some((c) => (samePort(c.a, a) && samePort(c.b, b)) || (samePort(c.a, b) && samePort(c.b, a)));
  if (duplicate) throw new ModelError("Esa conexión ya existe.");

  const connectionId = newId("cn");
  const connection: Connection = { id: connectionId, a, b };
  return {
    connectionId,
    project: touch({
      ...project,
      connections: [...project.connections, connection],
      diagram: { ...project.diagram, wires: { ...project.diagram.wires, [connectionId]: { waypoints: [] } } },
    }),
  };
}

export function disconnect(project: Project, connectionId: string): Project {
  const { [connectionId]: _removed, ...wires } = project.diagram.wires;
  return touch({
    ...project,
    connections: project.connections.filter((c) => c.id !== connectionId),
    diagram: { ...project.diagram, wires },
  });
}

export function samePort(x: PortRef, y: PortRef): boolean {
  return x.elementId === y.elementId && x.portId === y.portId;
}

/** Conexiones que llegan a un puerto. */
export function connectionsAt(project: Project, ref: PortRef): Connection[] {
  return project.connections.filter((c) => samePort(c.a, ref) || samePort(c.b, ref));
}

/** Mueve un elemento en el diagrama (solo representación). */
export function moveElement(project: Project, elementId: string, x: number, y: number): Project {
  const node = project.diagram.nodes[elementId];
  if (!node) throw new ModelError(`No existe el elemento "${elementId}" en el diagrama.`);
  return {
    ...project,
    diagram: { ...project.diagram, nodes: { ...project.diagram.nodes, [elementId]: { ...node, x, y } } },
  };
}

/** Fragmento copiado (portapapeles): elementos, sus conexiones internas y su posición. */
export interface Clip {
  elements: ProjectElement[];
  connections: Connection[];
  nodes: Record<string, DiagramNode>;
}

/** Extrae un fragmento con los elementos indicados y las conexiones entre ellos. */
export function extractClip(project: Project, elementIds: string[]): Clip {
  const ids = new Set(elementIds);
  const elements = project.elements.filter((e) => ids.has(e.id));
  return structuredClone({
    elements,
    connections: project.connections.filter((c) => ids.has(c.a.elementId) && ids.has(c.b.elementId)),
    nodes: Object.fromEntries(elements.map((e) => [e.id, project.diagram.nodes[e.id] ?? { x: 0, y: 0, rotation: 0 as const }])),
  });
}

/**
 * Pega un fragmento: las copias reciben ids y etiquetas automáticas nuevas, se desplazan
 * `offset` y conservan parámetros, rotación, notas y conexiones internas.
 */
export function pasteClip(
  project: Project,
  registry: ElementRegistry,
  clip: Clip,
  offset: { x: number; y: number } = { x: 40, y: 40 },
): { project: Project; idMap: Record<string, string> } {
  let p = project;
  const idMap: Record<string, string> = {};
  for (const src of clip.elements) {
    const pos = clip.nodes[src.id] ?? { x: 0, y: 0, rotation: 0 as const };
    const added = addElement(p, registry, src.type, {
      position: { x: pos.x + offset.x, y: pos.y + offset.y },
      params: structuredClone(src.params),
    });
    idMap[src.id] = added.elementId;
    p = added.project;
    const node = p.diagram.nodes[added.elementId]!;
    p = {
      ...p,
      elements: src.notes ? p.elements.map((e) => (e.id === added.elementId ? { ...e, notes: src.notes } : e)) : p.elements,
      diagram: { ...p.diagram, nodes: { ...p.diagram.nodes, [added.elementId]: { ...node, rotation: pos.rotation } } },
    };
  }
  for (const c of clip.connections) {
    const na = idMap[c.a.elementId];
    const nb = idMap[c.b.elementId];
    if (na && nb) p = connect(p, registry, { elementId: na, portId: c.a.portId }, { elementId: nb, portId: c.b.portId }).project;
  }
  return { project: p, idMap };
}

/**
 * Copia un conjunto de elementos dentro del mismo proyecto (equivale a copiar + pegar).
 * Se conservan las conexiones internas entre los copiados.
 */
export function duplicateElements(
  project: Project,
  registry: ElementRegistry,
  elementIds: string[],
  offset: { x: number; y: number } = { x: 40, y: 40 },
): { project: Project; idMap: Record<string, string> } {
  for (const id of elementIds) getElement(project, id);
  return pasteClip(project, registry, extractClip(project, elementIds), offset);
}

/** Gira elementos en el diagrama (solo representación), en pasos de 90° en sentido horario. */
export function rotateElements(project: Project, elementIds: string[], deltaDeg: 90 | 180 | 270 = 90): Project {
  const nodes = { ...project.diagram.nodes };
  for (const id of elementIds) {
    const n = nodes[id];
    if (!n) continue;
    nodes[id] = { ...n, rotation: ((n.rotation + deltaDeg) % 360) as DiagramNode["rotation"] };
  }
  return touch({ ...project, diagram: { ...project.diagram, nodes } });
}

/** Cambia parte de la configuración (norma, simbología, unidades...). No toca el modelo eléctrico. */
export function updateSettings(project: Project, changes: Partial<ProjectSettings>): Project {
  return touch({ ...project, settings: { ...project.settings, ...changes } });
}

/** Cambia datos generales del proyecto (nombre, cliente, ubicación...). */
export function updateMeta(project: Project, changes: Partial<Omit<ProjectMeta, "id" | "createdAt" | "updatedAt">>): Project {
  return touch({ ...project, meta: { ...project.meta, ...changes } });
}

/** Reasigna las etiquetas automáticas (no toca las editadas por el usuario), en orden de creación. */
export function renumberTags(project: Project, registry: ElementRegistry): Project {
  const locked = project.elements.filter((e) => e.tagLocked).map((e) => e.tag);
  const assigned: string[] = [...locked];
  const elements = project.elements.map((e) => {
    if (e.tagLocked) return e;
    const def = registry.get(e.type);
    const tag = nextFreeTag(assigned, def.tag.prefix, def.tag.style);
    assigned.push(tag);
    return { ...e, tag };
  });
  return touch({ ...project, elements });
}
