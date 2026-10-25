import { useReactFlow } from "@xyflow/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEditor, useProject } from "../state/store";
import { GRID, symbolOf, type NodeGeometry } from "./geometry";

/**
 * Agarraderas en los extremos de una barra o tablero seleccionado: al arrastrarlas la barra se
 * alarga o se acorta por ese lado (el otro extremo queda fijo), en pasos de la rejilla.
 */
export function BusHandles({ id, geometry }: { id: string; geometry: NodeGeometry }) {
  const project = useProject();
  const rf = useReactFlow();
  const el = project.elements.find((e) => e.id === id);
  const node = project.diagram.nodes[id];
  if (!el || !node) return null;
  const horizontal = geometry.rotation === 0 || geometry.rotation === 180;
  const minLength = symbolOf(project, el.type).width;

  const start = (side: "inicio" | "fin") => (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const zoom = rf.getZoom();
    const p0 = { x: e.clientX, y: e.clientY };
    const len0 = horizontal ? geometry.width : geometry.height;
    const n0 = { x: node.x, y: node.y };
    const ed = useEditor.getState();
    const move = (ev: PointerEvent) => {
      const raw = (horizontal ? ev.clientX - p0.x : ev.clientY - p0.y) / zoom;
      const d = Math.round(raw / GRID) * GRID;
      const len = Math.max(minLength, side === "fin" ? len0 + d : len0 - d);
      const shift = side === "inicio" ? len0 - len : 0;
      ed.resizeBusTransient(id, len, horizontal ? n0.x + shift : n0.x, horizontal ? n0.y : n0.y + shift);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      useEditor.getState().commitDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pos = (side: "inicio" | "fin") =>
    horizontal
      ? { left: side === "inicio" ? 0 : geometry.width, top: geometry.height / 2 }
      : { left: geometry.width / 2, top: side === "inicio" ? 0 : geometry.height };
  const title = "Arrastra para alargar o acortar la barra";
  return (
    <>
      {(["inicio", "fin"] as const).map((side) => (
        <div
          key={side}
          className={`bus-handle nodrag nopan ${horizontal ? "h" : "v"}`}
          style={pos(side)}
          title={title}
          aria-label={title}
          onPointerDown={start(side)}
        />
      ))}
    </>
  );
}
