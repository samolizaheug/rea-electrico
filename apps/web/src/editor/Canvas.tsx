import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type Connection as FlowConnection,
  type Edge,
  type FinalConnectionState,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { t } from "../i18n";
import { registry } from "../state/registry";
import { busAtPoint } from "./busSnap";
import { useEditor, useProject } from "../state/store";
import { useValidation } from "../state/validation";
import { ElementNode } from "./ElementNode";
import { IssuesPanel } from "./IssuesPanel";
import { GRID, busGeometry, chooseHandles, portOfHandle, snap, symbolOf } from "./geometry";
import { WireEdge, type WireEdgeType } from "./WireEdge";

export const DND_TYPE = "application/x-rea-element-type";
const nodeTypes = { element: ElementNode };
const edgeTypes = { wire: WireEdge };

/** Lienzo del unifilar. El estado vive en el modelo del proyecto; React Flow solo lo dibuja. */
export function Canvas() {
  const project = useProject();
  const selection = useEditor((s) => s.selection);
  const { add, connectPorts, remove, moveTransient, commitDrag, select } = useEditor.getState();
  const flow = useReactFlow();

  const validation = useValidation();
  const issuesOpen = useEditor((s) => s.issuesOpen);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);

  // Espacio sostenido = mover la vista temporalmente (como en programas de dibujo).
  const [space, setSpace] = useState(false);
  useEffect(() => {
    const typing = (el: EventTarget | null) => {
      const h = el as HTMLElement | null;
      return !!h && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.tagName === "SELECT" || h.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e.target)) {
        if (!e.repeat) setSpace(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Cuadro de selección según la dirección (como AutoCAD): hacia la derecha = solo lo que queda completo
  // adentro (ventana); hacia la izquierda = todo lo que toque (captura).
  const boxStart = useRef<number | null>(null);
  const [crossing, setCrossing] = useState(false);
  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (dragFrom.current !== null) {
      const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const hit = busAtPoint(useEditor.getState().history.present, registry, p.x, p.y, snapTolerance(), dragFrom.current);
      const id = hit?.busId ?? null;
      setSnapBus((cur) => (cur === id ? cur : id));
    }
    if (boxStart.current === null) return;
    const next = e.clientX < boxStart.current;
    setCrossing((c) => (c === next ? c : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow]);
  const panning = tool === "pan" || space;
  // Barra a la que se conectará el cable que se está arrastrando si se suelta aquí.
  const [snapBus, setSnapBus] = useState<string | null>(null);
  const dragFrom = useRef<string | null>(null);
  /** Tolerancia de 24 px en pantalla, en unidades del diagrama. */
  const snapTolerance = () => 24 / flow.getViewport().zoom;

  const nodes: Node[] = useMemo(() => {
    const selected = new Set(selection.elements);
    return project.elements.map((el) => {
      const n = project.diagram.nodes[el.id] ?? { x: 0, y: 0, rotation: 0 };
      return {
        id: el.id,
        type: "element",
        position: { x: n.x, y: n.y },
        data: { issue: validation.byElement.get(el.id) ?? null },
        selected: selected.has(el.id),
        ...(snapBus === el.id ? { className: "snap-target" } : {}),
      };
    });
  }, [project, selection.elements, validation, snapBus]);

  const edges: Edge[] = useMemo(() => {
    const selected = new Set(selection.connections);
    return project.connections.map((c): WireEdgeType => {
      const h = chooseHandles(project, c);
      const busA = busGeometry(project, c.a.elementId);
      const busB = busA ? null : busGeometry(project, c.b.elementId);
      return {
        id: c.id,
        source: c.a.elementId,
        target: c.b.elementId,
        sourceHandle: h.source,
        targetHandle: h.target,
        type: "wire",
        data: busA ? { bus: { ...busA, end: "source" } } : busB ? { bus: { ...busB, end: "target" } } : {},
        selected: selected.has(c.id),
      };
    });
  }, [project, selection.connections]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const moves: { id: string; x: number; y: number }[] = [];
      let dragEnded = false;
      let sel: Set<string> | null = null;
      for (const c of changes) {
        if (c.type === "position") {
          if (c.position) moves.push({ id: c.id, x: c.position.x, y: c.position.y });
          if (c.dragging === false) dragEnded = true;
        } else if (c.type === "select") {
          sel ??= new Set(useEditor.getState().selection.elements);
          if (c.selected) sel.add(c.id);
          else sel.delete(c.id);
        }
      }
      if (moves.length) moveTransient(moves);
      if (dragEnded) commitDrag();
      if (sel) select({ ...useEditor.getState().selection, elements: [...sel] });
    },
    [moveTransient, commitDrag, select],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      let sel: Set<string> | null = null;
      for (const c of changes) {
        if (c.type === "select") {
          sel ??= new Set(useEditor.getState().selection.connections);
          if (c.selected) sel.add(c.id);
          else sel.delete(c.id);
        }
      }
      if (sel) select({ ...useEditor.getState().selection, connections: [...sel] });
    },
    [select],
  );

  const onConnect = useCallback(
    (c: FlowConnection) => {
      // Punto k (≥ 1) de un CCM = barra de la sección k: la conexión recuerda esa sección.
      const project = useEditor.getState().history.present;
      const isMcc = (id: string) => project.elements.find((e) => e.id === id)?.type === "mcc";
      const idx = (h: string | null | undefined) => Number((h ?? "").split("@")[1] ?? 0);
      const section = isMcc(c.source) && idx(c.sourceHandle) > 0 ? idx(c.sourceHandle) : isMcc(c.target) && idx(c.targetHandle) > 0 ? idx(c.targetHandle) : undefined;
      connectPorts({ elementId: c.source, portId: portOfHandle(c.sourceHandle) }, { elementId: c.target, portId: portOfHandle(c.targetHandle) }, section);
    },
    [connectPorts],
  );

  // Soltar el cable en cualquier parte de una barra (no solo en su punto de conexión) también conecta.
  const onConnectEnd = useCallback(
    (e: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      dragFrom.current = null;
      setSnapBus(null);
      if (state.isValid || !state.fromNode || !state.fromHandle) return;
      const pt = "changedTouches" in e ? e.changedTouches[0] : e;
      if (!pt) return;
      const p = flow.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
      const hit = busAtPoint(useEditor.getState().history.present, registry, p.x, p.y, snapTolerance(), state.fromNode.id);
      if (!hit) return;
      connectPorts({ elementId: state.fromNode.id, portId: portOfHandle(state.fromHandle.id) }, { elementId: hit.busId, portId: hit.portId }, hit.section);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, connectPorts],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(DND_TYPE);
      if (!type) return;
      const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const s = symbolOf(useEditor.getState().history.present, type);
      add(type, { x: snap(p.x - s.width / 2), y: snap(p.y - s.height / 2) });
    },
    [flow, add],
  );

  return (
    <div
      className={`canvas ${crossing ? "box-crossing" : "box-window"}${panning ? " tool-pan" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onPointerMove={onPointerMove}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={(_, p) => {
          dragFrom.current = p.nodeId ?? null;
        }}
        onConnectEnd={onConnectEnd}
        onDelete={({ nodes: n, edges: e }) => remove(n.map((x) => x.id), e.map((x) => x.id))}
        isValidConnection={(c) => c.source !== c.target}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[GRID, GRID]}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode={["Shift", "Control", "Meta"]}
        selectionKeyCode={panning && !space ? "Shift" : null}
        selectionOnDrag={!panning}
        panOnDrag={panning ? true : [1]}
        selectionMode={crossing ? SelectionMode.Partial : SelectionMode.Full}
        onSelectionStart={(e) => {
          boxStart.current = e.clientX;
          setCrossing(false);
        }}
        onSelectionEnd={() => {
          boxStart.current = null;
        }}
        disableKeyboardA11y
        minZoom={0.1}
        maxZoom={4}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={GRID} color="var(--grid)" />
        <Controls showInteractive={false} />
        <div className="canvas-tools" role="group" aria-label="Herramienta">
          <button type="button" className={tool === "select" ? "active" : ""} aria-pressed={tool === "select"} title={t("canvas.toolSelectHelp")} onClick={() => setTool("select")}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 2" />
              <path d="M7 6 L7 14 L9.2 11.8 L10.8 15 L12 14.4 L10.4 11.3 L13.4 11.1 Z" fill="currentColor" />
            </svg>
            {t("canvas.toolSelect")}
          </button>
          <button type="button" className={tool === "pan" ? "active" : ""} aria-pressed={tool === "pan"} title={t("canvas.toolPanHelp")} onClick={() => setTool("pan")}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {t("canvas.toolPan")}
          </button>
        </div>
        <MiniMap pannable zoomable className="minimap" />
      </ReactFlow>
      {issuesOpen ? <IssuesPanel onClose={() => useEditor.getState().setIssuesOpen(false)} /> : null}
    </div>
  );
}
