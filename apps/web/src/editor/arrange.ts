import { moveElement, type ElementRegistry, type Project } from "@rea/core";
import { nodeGeometry } from "@rea/symbols";

/** Cómo alinear: bordes o centro, horizontal (izquierda/centro/derecha) o vertical (arriba/medio/abajo). */
export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function boxes(project: Project, registry: ElementRegistry, ids: string[]): Box[] {
  const out: Box[] = [];
  for (const id of ids) {
    const n = project.diagram.nodes[id];
    const g = nodeGeometry(project, registry, id);
    if (n && g) out.push({ id, x: n.x, y: n.y, w: g.width, h: g.height });
  }
  return out;
}

/** Desplaza varios elementos juntos (sus cables los siguen). */
export function nudgeElements(project: Project, ids: string[], dx: number, dy: number): Project {
  if (!dx && !dy) return project;
  return ids.reduce((p, id) => {
    const n = p.diagram.nodes[id];
    return n ? moveElement(p, id, n.x + dx, n.y + dy) : p;
  }, project);
}

/**
 * Alinea los elementos con el más extremo de la selección (izquierda, arriba…) o con el centro
 * del conjunto (centro, medio). En un unifilar lo usual es alinear centros para que los cables queden rectos.
 */
export function alignElements(project: Project, registry: ElementRegistry, ids: string[], mode: AlignMode): Project {
  const bs = boxes(project, registry, ids);
  if (bs.length < 2) return project;
  const minX = Math.min(...bs.map((b) => b.x));
  const maxX = Math.max(...bs.map((b) => b.x + b.w));
  const minY = Math.min(...bs.map((b) => b.y));
  const maxY = Math.max(...bs.map((b) => b.y + b.h));
  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  return bs.reduce((p, b) => {
    let { x, y } = b;
    if (mode === "left") x = minX;
    else if (mode === "right") x = maxX - b.w;
    else if (mode === "center") x = cx - b.w / 2;
    else if (mode === "top") y = minY;
    else if (mode === "bottom") y = maxY - b.h;
    else y = cy - b.h / 2;
    return x === b.x && y === b.y ? p : moveElement(p, b.id, x, y);
  }, project);
}

/**
 * Reparte los elementos con la misma separación entre ellos (entre bordes), dejando fijos
 * el primero y el último en el eje elegido.
 */
export function spreadElements(project: Project, registry: ElementRegistry, ids: string[], axis: "x" | "y"): Project {
  const bs = boxes(project, registry, ids);
  if (bs.length < 3) return project;
  const pos = (b: Box) => (axis === "x" ? b.x : b.y);
  const size = (b: Box) => (axis === "x" ? b.w : b.h);
  bs.sort((a, b) => pos(a) - pos(b));
  const first = bs[0]!;
  const last = bs[bs.length - 1]!;
  const used = bs.reduce((s, b) => s + size(b), 0);
  const gap = (pos(last) + size(last) - pos(first) - used) / (bs.length - 1);
  let cursor = pos(first);
  return bs.reduce((p, b) => {
    const at = Math.round(cursor);
    cursor += size(b) + gap;
    if (at === pos(b)) return p;
    return axis === "x" ? moveElement(p, b.id, at, b.y) : moveElement(p, b.id, b.x, at);
  }, project);
}
