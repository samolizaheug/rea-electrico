import { BaseEdge, Position, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";
import type { BusGeometry } from "./geometry";

export type WireEdgeData = { bus?: BusGeometry & { end: "source" | "target" } };
export type WireEdgeType = Edge<WireEdgeData, "wire">;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Radio del círculo de puerto (ver .port en styles.css). React Flow entrega el borde del círculo; se regresa al centro. */
const PORT_RADIUS = 4.5;
function toPortCenter(x: number, y: number, p: Position) {
  switch (p) {
    case Position.Top:
      return { x, y: y + PORT_RADIUS, p };
    case Position.Bottom:
      return { x, y: y - PORT_RADIUS, p };
    case Position.Left:
      return { x: x + PORT_RADIUS, y, p };
    case Position.Right:
      return { x: x - PORT_RADIUS, y, p };
  }
}

/**
 * Conductor ortogonal. Si un extremo es una barra, la conexión se dibuja como derivación:
 * sale perpendicular a la barra en el punto más cercano al otro elemento (como en un unifilar).
 */
export function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, interactionWidth }: EdgeProps<WireEdgeType>) {
  let s = toPortCenter(sourceX, sourceY, sourcePosition);
  let t = toPortCenter(targetX, targetY, targetPosition);
  const bus = data?.bus;
  if (bus) {
    const other = bus.end === "source" ? t : s;
    let tap: { x: number; y: number; p: Position };
    if (bus.horizontal) {
      const below = other.y >= bus.cy;
      tap = { x: clamp(other.x, bus.cx - bus.halfLength, bus.cx + bus.halfLength), y: bus.cy + (below ? bus.halfThickness : -bus.halfThickness), p: below ? Position.Bottom : Position.Top };
    } else {
      const right = other.x >= bus.cx;
      tap = { x: bus.cx + (right ? bus.halfThickness : -bus.halfThickness), y: clamp(other.y, bus.cy - bus.halfLength, bus.cy + bus.halfLength), p: right ? Position.Right : Position.Left };
    }
    if (bus.end === "source") s = tap;
    else t = tap;
  }
  const [path] = getSmoothStepPath({ sourceX: s.x, sourceY: s.y, sourcePosition: s.p, targetX: t.x, targetY: t.y, targetPosition: t.p, borderRadius: 0, offset: 10 });
  return <BaseEdge id={id} path={path} style={style} interactionWidth={interactionWidth ?? 12} />;
}
