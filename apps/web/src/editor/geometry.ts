import type { Connection, Project } from "@rea/core";
import { busGeometry as busGeometryOf, chooseAnchors, nodeGeometry as nodeGeometryOf, symbolFor, type BusGeometry, type NodeGeometry, type SymbolDef } from "@rea/symbols";
import { registry } from "../state/registry";

export type { BusGeometry, NodeGeometry };

export const GRID = 20;
export const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Identificador de "handle" de React Flow: puerto + índice del punto de conexión. */
export const handleId = (portId: string, index: number) => `${portId}@${index}`;
export const portOfHandle = (handle: string | null | undefined) => (handle ?? "").split("@")[0] ?? "";

export function symbolOf(project: Project, type: string): SymbolDef {
  return symbolFor(registry.get(type), project.settings.symbology);
}

export const nodeGeometry = (project: Project, elementId: string): NodeGeometry | null => nodeGeometryOf(project, registry, elementId);

/** Geometría absoluta de la barra de un tablero/barra, o null si el elemento no es barra. */
export const busGeometry = (project: Project, elementId: string): BusGeometry | null => busGeometryOf(project, registry, elementId);

/** Handles de React Flow del par de puntos de conexión más cercano (ver chooseAnchors). */
export function chooseHandles(project: Project, c: Connection): { source: string; target: string } {
  const i = chooseAnchors(project, registry, c);
  return { source: handleId(c.a.portId, i.a), target: handleId(c.b.portId, i.b) };
}
