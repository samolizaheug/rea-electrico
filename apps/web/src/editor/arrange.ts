import { moveElement, type Project } from "@rea/core";

/** Desplaza varios elementos juntos (sus cables los siguen). */
export function nudgeElements(project: Project, ids: string[], dx: number, dy: number): Project {
  if (!dx && !dy) return project;
  return ids.reduce((p, id) => {
    const n = p.diagram.nodes[id];
    return n ? moveElement(p, id, n.x + dx, n.y + dy) : p;
  }, project);
}
