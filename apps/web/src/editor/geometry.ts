import type { Connection, Project } from "@rea/core";
import { rotatedAnchors, rotatedSize, symbolFor, type Anchor, type Rotation, type SymbolDef } from "@rea/symbols";
import { registry } from "../state/registry";

export const GRID = 20;
export const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Identificador de "handle" de React Flow: puerto + índice del punto de conexión. */
export const handleId = (portId: string, index: number) => `${portId}@${index}`;
export const portOfHandle = (handle: string | null | undefined) => (handle ?? "").split("@")[0] ?? "";

export function symbolOf(project: Project, type: string): SymbolDef {
  return symbolFor(registry.get(type), project.settings.symbology);
}

export interface NodeGeometry {
  symbol: SymbolDef;
  rotation: Rotation;
  width: number;
  height: number;
  anchors: Record<string, Anchor[]>;
}

export function nodeGeometry(project: Project, elementId: string): NodeGeometry | null {
  const el = project.elements.find((e) => e.id === elementId);
  const node = project.diagram.nodes[elementId];
  if (!el || !node) return null;
  const symbol = symbolOf(project, el.type);
  const rotation = node.rotation as Rotation;
  return { symbol, rotation, ...rotatedSize(symbol, rotation), anchors: rotatedAnchors(symbol, rotation) };
}

/** Geometría absoluta de la barra de un tablero/barra, o null si el elemento no es barra. */
export interface BusGeometry {
  cx: number;
  cy: number;
  horizontal: boolean;
  halfLength: number;
  halfThickness: number;
}

export function busGeometry(project: Project, elementId: string): BusGeometry | null {
  const g = nodeGeometry(project, elementId);
  const n = project.diagram.nodes[elementId];
  if (!g?.symbol.bus || !n) return null;
  return {
    cx: n.x + g.width / 2,
    cy: n.y + g.height / 2,
    horizontal: g.rotation === 0 || g.rotation === 180,
    halfLength: g.symbol.bus.halfLength,
    halfThickness: g.symbol.bus.halfThickness,
  };
}

/**
 * Para una conexión entre puertos con varios puntos (barras con anclaje arriba y abajo),
 * elige el par de puntos más cercano en el diagrama.
 */
export function chooseHandles(project: Project, c: Connection): { source: string; target: string } {
  const pick = (ref: Connection["a"]) => {
    const g = nodeGeometry(project, ref.elementId);
    const n = project.diagram.nodes[ref.elementId];
    return (g?.anchors[ref.portId] ?? [{ x: 0, y: 0, side: "top" as const }]).map((a, i) => ({ i, x: (n?.x ?? 0) + a.x, y: (n?.y ?? 0) + a.y }));
  };
  const as = pick(c.a);
  const bs = pick(c.b);
  let best = { ai: 0, bi: 0, d: Infinity };
  for (const a of as) {
    for (const b of bs) {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < best.d) best = { ai: a.i, bi: b.i, d };
    }
  }
  return { source: handleId(c.a.portId, best.ai), target: handleId(c.b.portId, best.bi) };
}
