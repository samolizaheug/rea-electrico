import type { Connection, ElementRegistry, PortRef, Project } from "@rea/core";
import { rotatedAnchors, rotatedSize, symbolFor } from "./index";
import type { Anchor, Rotation, Side, SymbolDef } from "./types";

/**
 * Geometría del unifilar a partir del modelo: tamaño y puntos de conexión de cada símbolo,
 * barras y derivaciones. La comparten el editor y la exportación, para que el dibujo
 * exportado sea igual al de pantalla.
 */

export interface NodeGeometry {
  symbol: SymbolDef;
  rotation: Rotation;
  width: number;
  height: number;
  anchors: Record<string, Anchor[]>;
}

export function nodeGeometry(project: Project, registry: ElementRegistry, elementId: string): NodeGeometry | null {
  const el = project.elements.find((e) => e.id === elementId);
  const node = project.diagram.nodes[elementId];
  if (!el || !node) return null;
  const def = registry.tryGet(el.type);
  if (!def) return null;
  const symbol = symbolFor(def, project.settings.symbology);
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

export function busGeometry(project: Project, registry: ElementRegistry, elementId: string): BusGeometry | null {
  const g = nodeGeometry(project, registry, elementId);
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

/** Punto absoluto de conexión, con el lado del símbolo por el que sale el conductor. */
export interface WirePoint {
  x: number;
  y: number;
  side: Side;
}

function absoluteAnchors(project: Project, registry: ElementRegistry, ref: PortRef): WirePoint[] {
  const g = nodeGeometry(project, registry, ref.elementId);
  const n = project.diagram.nodes[ref.elementId];
  const list = g?.anchors[ref.portId] ?? [{ x: 0, y: 0, side: "top" as const }];
  return list.map((a) => ({ x: (n?.x ?? 0) + a.x, y: (n?.y ?? 0) + a.y, side: a.side }));
}

/**
 * Para una conexión entre puertos con varios puntos (barras con anclaje arriba y abajo),
 * elige el par de puntos más cercano en el diagrama. Devuelve los índices.
 */
export function chooseAnchors(project: Project, registry: ElementRegistry, c: Connection): { a: number; b: number } {
  const as = absoluteAnchors(project, registry, c.a);
  const bs = absoluteAnchors(project, registry, c.b);
  let best = { a: 0, b: 0, d: Infinity };
  as.forEach((pa, ai) =>
    bs.forEach((pb, bi) => {
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (d < best.d) best = { a: ai, b: bi, d };
    }),
  );
  return { a: best.a, b: best.b };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Derivación desde una barra: sale perpendicular a la barra en el punto más cercano al otro
 * extremo del conductor (como se dibuja en un unifilar).
 */
export function busTap(bus: BusGeometry, other: { x: number; y: number }): WirePoint {
  if (bus.horizontal) {
    const below = other.y >= bus.cy;
    return { x: clamp(other.x, bus.cx - bus.halfLength, bus.cx + bus.halfLength), y: bus.cy + (below ? bus.halfThickness : -bus.halfThickness), side: below ? "bottom" : "top" };
  }
  const right = other.x >= bus.cx;
  return { x: bus.cx + (right ? bus.halfThickness : -bus.halfThickness), y: clamp(other.y, bus.cy - bus.halfLength, bus.cy + bus.halfLength), side: right ? "right" : "left" };
}

/** Extremos de un conductor del unifilar (con la derivación de barra ya aplicada). */
export function wireEnds(project: Project, registry: ElementRegistry, c: Connection): { a: WirePoint; b: WirePoint } {
  const idx = chooseAnchors(project, registry, c);
  let a = absoluteAnchors(project, registry, c.a)[idx.a]!;
  let b = absoluteAnchors(project, registry, c.b)[idx.b]!;
  const busA = busGeometry(project, registry, c.a.elementId);
  const busB = busA ? null : busGeometry(project, registry, c.b.elementId);
  if (busA) a = busTap(busA, b);
  else if (busB) b = busTap(busB, a);
  return { a, b };
}
