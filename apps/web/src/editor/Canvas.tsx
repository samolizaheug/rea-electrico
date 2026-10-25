import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection as FlowConnection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useMemo, type DragEvent } from "react";
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
      };
    });
  }, [project, selection.elements, validation]);

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
      connectPorts({ elementId: c.source, portId: portOfHandle(c.sourceHandle) }, { elementId: c.target, portId: portOfHandle(c.targetHandle) });
    },
    [connectPorts],
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
    <div className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={({ nodes: n, edges: e }) => remove(n.map((x) => x.id), e.map((x) => x.id))}
        isValidConnection={(c) => c.source !== c.target}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[GRID, GRID]}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode={["Shift", "Control", "Meta"]}
        selectionKeyCode="Shift"
        minZoom={0.1}
        maxZoom={4}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} gap={GRID} color="var(--grid)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="minimap" />
      </ReactFlow>
      {issuesOpen ? <IssuesPanel onClose={() => useEditor.getState().setIssuesOpen(false)} /> : null}
    </div>
  );
}
