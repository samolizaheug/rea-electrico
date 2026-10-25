import { busTap, type BusGeometry } from "@rea/symbols";
import { BaseEdge, Position, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";

export type WireEdgeData = { bus?: BusGeometry & { end: "source" | "target" } };
export type WireEdgeType = Edge<WireEdgeData, "wire">;

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
 * La exportación (@rea/reports) usa la misma geometría y el mismo trazo.
 */
export function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, interactionWidth }: EdgeProps<WireEdgeType>) {
  let s = toPortCenter(sourceX, sourceY, sourcePosition);
  let t = toPortCenter(targetX, targetY, targetPosition);
  const bus = data?.bus;
  if (bus) {
    const tap = busTap(bus, bus.end === "source" ? t : s);
    const p = { x: tap.x, y: tap.y, p: tap.side as Position };
    if (bus.end === "source") s = p;
    else t = p;
  }
  const [path] = getSmoothStepPath({ sourceX: s.x, sourceY: s.y, sourcePosition: s.p, targetX: t.x, targetY: t.y, targetPosition: t.p, borderRadius: 0, offset: 10 });
  return <BaseEdge id={id} path={path} style={style} interactionWidth={interactionWidth ?? 12} />;
}
