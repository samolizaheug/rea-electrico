import { rotationTransform, symbolBody } from "@rea/symbols";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";
import { resultBadge } from "../results/format";
import { registry } from "../state/registry";
import { useEditor, useProject } from "../state/store";
import { useValidation } from "../state/validation";
import { BusHandles } from "./BusHandles";
import { handleId, nodeGeometry } from "./geometry";

const POSITION = { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right } as const;

/** Nodo del lienzo: dibuja el símbolo en la simbología del proyecto, sus puertos y su etiqueta. */
function ElementNodeImpl({ id, selected, data }: NodeProps) {
  const issue = (data as { issue?: "error" | "warning" | null }).issue ?? null;
  const project = useProject();
  const showResults = useEditor((s) => s.showResults);
  const results = useValidation().results;
  const geometry = nodeGeometry(project, id);
  const element = project.elements.find((e) => e.id === id);

  const svgBody = useMemo(() => {
    if (!geometry) return "";
    const body = symbolBody(geometry.symbol, geometry.rotation);
    const t = rotationTransform(geometry.symbol, geometry.rotation);
    return t ? `<g transform="${t}">${body}</g>` : body;
  }, [geometry?.symbol, geometry?.rotation]);

  if (!geometry || !element) return null;
  const { width, height, anchors } = geometry;
  const badge = showResults && results ? resultBadge(id, element.type, results) : [];
  // Cargas: etiqueta debajo del símbolo (el conductor llega por arriba). Otros símbolos verticales
  // angostos: a la derecha. Barras y símbolos girados: arriba.
  const isLoad = registry.tryGet(element.type)?.category === "carga" && registry.get(element.type).ports.length === 1;
  const labelPos = isLoad ? "below" : width <= 60 && (geometry.rotation === 0 || geometry.rotation === 180) ? "side" : "above";

  return (
    <div className={`element-node${selected ? " selected" : ""}${issue ? ` issue-${issue}` : ""}`} style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible" dangerouslySetInnerHTML={{ __html: svgBody }} />
      <div className={`element-tag ${labelPos}`}>
        {issue ? <span className={`issue-badge ${issue}`} aria-label={issue === "error" ? "error" : "advertencia"}>{issue === "error" ? "!" : "?"}</span> : null}
        {element.tag}
        {badge.map((line) => (
          <span key={line} className="element-result">
            {line}
          </span>
        ))}
      </div>
      {selected && geometry.symbol.bus ? <BusHandles id={id} geometry={geometry} /> : null}
      {Object.entries(anchors).flatMap(([portId, list]) =>
        list.map((a, i) => (
          <Handle
            key={handleId(portId, i)}
            id={handleId(portId, i)}
            type="source"
            position={POSITION[a.side]}
            className="port"
            style={{ left: a.x, top: a.y, right: "auto", bottom: "auto", transform: "translate(-50%, -50%)" }}
          />
        )),
      )}
    </div>
  );
}

export const ElementNode = memo(ElementNodeImpl);
