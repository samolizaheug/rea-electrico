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

/**
 * Estira horizontalmente un símbolo de barra hasta `width`: lo que está a la izquierda del centro
 * se queda, lo que está a la derecha se recorre todo el aumento y lo que está en el centro, la mitad.
 * Así la barra crece por ambos extremos y los detalles (p. ej. el texto «CCM») conservan su tamaño.
 */
export function stretchBusSymbol(s: SymbolDef, width: number): SymbolDef {
  if (!s.bus || width <= s.width) return s;
  const extra = width - s.width;
  const cx = s.width / 2;
  const mx = (x: number) => (x < cx - 1e-9 ? x : x > cx + 1e-9 ? x + extra : x + extra / 2);
  return {
    ...s,
    width,
    ports: Object.fromEntries(Object.entries(s.ports).map(([k, list]) => [k, list.map((a) => ({ ...a, x: mx(a.x) }))])),
    shapes: s.shapes.map((p) => {
      switch (p.k) {
        case "line":
          return { ...p, x1: mx(p.x1), x2: mx(p.x2) };
        case "rect":
          return { ...p, x: mx(p.x), w: mx(p.x + p.w) - mx(p.x) };
        case "circle":
          return { ...p, cx: mx(p.cx) };
        case "text":
          return { ...p, x: mx(p.x) };
        case "path":
          return p;
      }
    }),
    bus: { ...s.bus, halfLength: s.bus.halfLength + extra / 2 },
  };
}

export function nodeGeometry(project: Project, registry: ElementRegistry, elementId: string): NodeGeometry | null {
  const el = project.elements.find((e) => e.id === elementId);
  const node = project.diagram.nodes[elementId];
  if (!el || !node) return null;
  const def = registry.tryGet(el.type);
  if (!def) return null;
  const base = symbolFor(def, project.settings.symbology);
  const symbol = base.bus && node.length ? stretchBusSymbol(base, node.length) : base;
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
