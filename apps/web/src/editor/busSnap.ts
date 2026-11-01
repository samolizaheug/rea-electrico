import type { ElementRegistry, Project } from "@rea/core";
import { busGeometry, mccSectionAt } from "@rea/symbols";

export interface BusHit {
  busId: string;
  portId: string;
  /** Sección del CCM bajo el punto (solo CCM). */
  section?: number;
}

/**
 * Barra (tablero, barra o CCM) más cercana a un punto del diagrama, a no más de `tolerance`
 * unidades de su trazo (en el CCM cuenta todo su cuerpo, hasta las barras de sección).
 * Sirve para conectar un cable soltándolo en cualquier parte de la barra, no solo en su punto de conexión.
 */
export function busAtPoint(project: Project, registry: ElementRegistry, x: number, y: number, tolerance: number, exclude?: string): BusHit | null {
  let best: { id: string; d: number } | null = null;
  for (const el of project.elements) {
    if (el.id === exclude) continue;
    const g = busGeometry(project, registry, el.id);
    if (!g) continue;
    const [along, across] = g.horizontal ? [x - g.cx, y - g.cy] : [y - g.cy, x - g.cx];
    const dAlong = Math.max(0, Math.abs(along) - g.halfLength);
    const dAcross = Math.max(0, Math.abs(across) - g.halfThickness);
    const d = Math.hypot(dAlong, dAcross);
    if (d <= tolerance && (!best || d < best.d)) best = { id: el.id, d };
  }
  if (!best) return null;
  const el = project.elements.find((e) => e.id === best.id)!;
  const portId = registry.tryGet(el.type)?.ports[0]?.id;
  if (!portId) return null;
  // En el CCM, un cable que llega por abajo sale de la sección bajo el cursor; por arriba es su alimentación.
  const g = busGeometry(project, registry, el.id)!;
  const section = el.type === "mcc" && y > g.cy ? mccSectionAt(project, registry, el.id, x) : undefined;
  return { busId: el.id, portId, ...(section ? { section } : {}) };
}
