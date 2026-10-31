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

// ---------------------------------------------------------------- CCM por secciones

const MCC_MIN_SECTION_WIDTH = 110;
const MCC_HEIGHT = 84;
const MCC_BOX = { x: 4, top: 6, bottom: 78 };

/** Datos de secciones de un CCM a partir de sus parámetros. */
export function mccLayout(params: Record<string, unknown>): { sections: number; vertical: (number | undefined)[] } {
  const sections = Math.max(1, Math.round(typeof params.sections === "number" && Number.isFinite(params.sections) ? params.sections : 1));
  const common = typeof params.verticalBusA === "number" ? params.verticalBusA : undefined;
  const list = String(params.verticalBusBySection ?? "")
    .split(/[,;]/)
    .map((x) => Number(x.trim()))
    .filter((x) => x > 0);
  const vertical = Array.from({ length: sections }, (_, i) => (list.length === sections ? list[i] : common));
  return { sections, vertical };
}

/** Ancho por omisión de un CCM: crece con el número de secciones. */
export function mccDefaultWidth(sections: number): number {
  return Math.max(160, sections * MCC_MIN_SECTION_WIDTH);
}

/**
 * Símbolo de CCM dibujado por secciones: envolvente, bus horizontal arriba y, en cada sección, su bus
 * vertical con la etiqueta «S1 · 300 A». Las derivaciones salen por abajo en cualquier punto.
 */
export function mccSymbol(base: SymbolDef, width: number, params: Record<string, unknown>): SymbolDef {
  const { sections, vertical } = mccLayout(params);
  const w = Math.max(width, 160);
  const inner = w - 2 * MCC_BOX.x;
  const cw = inner / sections;
  const L = (x1: number, y1: number, x2: number, y2: number, lw?: number) => ({ k: "line" as const, x1, y1, x2, y2, w: lw });
  const shapes: SymbolDef["shapes"] = [
    { k: "rect", x: MCC_BOX.x, y: MCC_BOX.top, w: inner, h: MCC_BOX.bottom - MCC_BOX.top },
    L(MCC_BOX.x + 4, 16, w - MCC_BOX.x - 4, 16, 4),
    { k: "text", x: w - MCC_BOX.x - 16, y: 11, text: "CCM", size: 7 },
  ];
  for (let i = 0; i < sections; i++) {
    const x0 = MCC_BOX.x + i * cw;
    if (i > 0) shapes.push(L(x0, MCC_BOX.top, x0, MCC_BOX.bottom, 1));
    const vx = x0 + Math.min(18, cw * 0.2);
    shapes.push(L(vx, 16, vx, MCC_BOX.bottom - 4, 3), { k: "circle", cx: vx, cy: 16, r: 2.5, fill: true });
    const tx = vx + (x0 + cw - vx) / 2;
    shapes.push({ k: "text", x: tx, y: 40, text: `S${i + 1}`, size: 10 });
    if (vertical[i] !== undefined) shapes.push({ k: "text", x: tx, y: 56, text: `${vertical[i]} A`, size: 9, weight: "normal" });
  }
  return {
    ...base,
    width: w,
    height: MCC_HEIGHT,
    ports: { bus: [{ x: w / 2, y: 0, side: "top" }, { x: w / 2, y: MCC_HEIGHT, side: "bottom" }] },
    shapes,
    bus: { halfLength: inner / 2 - 4, halfThickness: MCC_HEIGHT / 2 - MCC_BOX.top },
  };
}

/** Sección del CCM en la que cae una abscisa absoluta del diagrama (1 … n). */
export function mccSectionAt(project: Project, registry: ElementRegistry, mccId: string, x: number): number | undefined {
  const el = project.elements.find((e) => e.id === mccId);
  const n = project.diagram.nodes[mccId];
  const g = nodeGeometry(project, registry, mccId);
  if (!el || !n || !g || g.rotation !== 0) return undefined;
  const { sections } = mccLayout(el.params);
  const cw = (g.width - 2 * MCC_BOX.x) / sections;
  return Math.min(sections, Math.max(1, Math.floor((x - n.x - MCC_BOX.x) / cw) + 1));
}

/**
 * Asigna la sección del CCM («mccSection») a cada elemento conectado directamente a un CCM, según dónde
 * está dibujado (bajo qué sección). Devuelve el mismo proyecto si nada cambia.
 */
export function syncMccSections(project: Project, registry: ElementRegistry): Project {
  const mccs = new Set(project.elements.filter((e) => e.type === "mcc").map((e) => e.id));
  if (!mccs.size) return project;
  const updates = new Map<string, number>();
  for (const c of project.connections) {
    for (const [bus, other] of [[c.a, c.b], [c.b, c.a]] as const) {
      if (!mccs.has(bus.elementId) || mccs.has(other.elementId)) continue;
      const def = registry.tryGet(project.elements.find((e) => e.id === other.elementId)?.type ?? "");
      if (!def?.params.some((p) => p.key === "mccSection")) continue;
      const g = nodeGeometry(project, registry, other.elementId);
      const n = project.diagram.nodes[other.elementId];
      if (!g || !n) continue;
      const s = mccSectionAt(project, registry, bus.elementId, n.x + g.width / 2);
      if (s !== undefined) updates.set(other.elementId, s);
    }
  }
  // Elementos que ya no cuelgan de un CCM pierden la sección.
  const target = (e: Project["elements"][number]) => (updates.has(e.id) ? updates.get(e.id)! : typeof e.params.mccSection === "number" ? null : e.params.mccSection);
  if (!project.elements.some((e) => (e.params.mccSection ?? null) !== (target(e) ?? null))) return project;
  return {
    ...project,
    elements: project.elements.map((e) => ((e.params.mccSection ?? null) !== (target(e) ?? null) ? { ...e, params: { ...e.params, mccSection: target(e) ?? null } } : e)),
  };
}

export function nodeGeometry(project: Project, registry: ElementRegistry, elementId: string): NodeGeometry | null {
  const el = project.elements.find((e) => e.id === elementId);
  const node = project.diagram.nodes[elementId];
  if (!el || !node) return null;
  const def = registry.tryGet(el.type);
  if (!def) return null;
  const base = symbolFor(def, project.settings.symbology);
  const symbol =
    el.type === "mcc"
      ? mccSymbol(base, node.length ?? mccDefaultWidth(mccLayout(el.params).sections), el.params)
      : base.bus && node.length
        ? stretchBusSymbol(base, node.length)
        : base;
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
