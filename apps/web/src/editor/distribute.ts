import { moveElement, resizeBus, type ElementRegistry, type Project } from "@rea/core";
import { mccLayout, mccSectionAt, nodeGeometry } from "@rea/symbols";
import { GRID } from "./geometry";

/** Separación mínima entre circuitos vecinos (px del diagrama), además de sus textos. */
const GAP = 24;
/** Ancho aproximado por carácter de la etiqueta (11 px negrita) y de los renglones de resultados (10 px). */
const TAG_CHAR = 7;
const LINE_CHAR = 6.2;

interface Branch {
  root: string;
  ids: string[];
  minX: number;
  maxX: number;
  section: number;
}

/**
 * Extensión horizontal de un elemento con su etiqueta, igual que la dibuja el editor:
 * cargas con el texto centrado debajo; símbolos angostos con el texto a la derecha; los demás, arriba.
 */
function extent(project: Project, registry: ElementRegistry, id: string, linesOf: (id: string) => string[]): [number, number] | null {
  const el = project.elements.find((e) => e.id === id);
  const n = project.diagram.nodes[id];
  const g = nodeGeometry(project, registry, id);
  if (!el || !n || !g) return null;
  const lines = linesOf(id);
  const textW = Math.max(el.tag.length * TAG_CHAR, ...lines.map((l) => l.length * LINE_CHAR)) + 4;
  const def = registry.tryGet(el.type);
  const isLoad = def?.category === "carga" && def.ports.length === 1;
  const side = g.width <= 60 && (g.rotation === 0 || g.rotation === 180);
  const cx = n.x + g.width / 2;
  if (isLoad) return [Math.min(n.x, cx - textW / 2), Math.max(n.x + g.width, cx + textW / 2)];
  if (side) return [n.x, n.x + g.width + 6 + textW];
  return [n.x, Math.max(n.x + g.width, n.x + textW)];
}

/**
 * Distribuye horizontalmente los circuitos que salen de una barra (tablero, barra o CCM): cada circuito
 * se mueve completo (interruptor, cable, carga y lo que cuelgue de ella) para que ni símbolos ni textos se
 * encimen, con la separación mínima, y la barra se alarga lo necesario. En un CCM se acomoda cada sección
 * por separado y todas quedan del ancho de la más llena.
 */
export function distributeBus(project: Project, registry: ElementRegistry, busId: string, linesOf: (id: string) => string[]): Project {
  const bus = project.elements.find((e) => e.id === busId);
  const bn = project.diagram.nodes[busId];
  const bg = nodeGeometry(project, registry, busId);
  if (!bus || !bn || !bg?.symbol.bus || bg.rotation !== 0) return project;
  const busCy = bn.y + bg.height / 2;
  const isMcc = bus.type === "mcc";

  // Vecinos de cada elemento (sin pasar por la barra).
  const adj = new Map<string, Set<string>>();
  for (const c of project.connections) {
    for (const [x, y] of [[c.a.elementId, c.b.elementId], [c.b.elementId, c.a.elementId]] as const) {
      (adj.get(x) ?? adj.set(x, new Set()).get(x)!).add(y);
    }
  }

  const taken = new Set<string>([busId]);
  const branches: Branch[] = [];
  const feederXs: number[] = [];
  for (const c of project.connections) {
    const other = c.a.elementId === busId ? c.b.elementId : c.b.elementId === busId ? c.a.elementId : null;
    if (!other || taken.has(other)) continue;
    const on = project.diagram.nodes[other];
    const og = nodeGeometry(project, registry, other);
    if (!on || !og) continue;
    // Lo que está arriba de la barra es su alimentación: no se mueve.
    if (on.y + og.height / 2 < busCy) {
      feederXs.push(on.x + og.width / 2);
      continue;
    }
    // Todo lo que cuelga del circuito (sin regresar a la barra ni subir por encima de ella).
    const ids: string[] = [];
    const queue = [other];
    while (queue.length) {
      const id = queue.shift()!;
      if (taken.has(id)) continue;
      const nn = project.diagram.nodes[id];
      if (!nn || nn.y < bn.y) continue;
      taken.add(id);
      ids.push(id);
      for (const nb of adj.get(id) ?? []) if (!taken.has(nb)) queue.push(nb);
    }
    const ext = ids.map((id) => extent(project, registry, id, linesOf)).filter((e): e is [number, number] => !!e);
    if (!ext.length) continue;
    const section = isMcc ? (c.busSection ?? (typeof project.elements.find((e) => e.id === other)?.params.mccSection === "number" ? (project.elements.find((e) => e.id === other)!.params.mccSection as number) : mccSectionAt(project, registry, busId, on.x + og.width / 2) ?? 1)) : 1;
    branches.push({ root: other, ids, minX: Math.min(...ext.map((e) => e[0])), maxX: Math.max(...ext.map((e) => e[1])), section });
  }
  if (!branches.length) return project;

  const width = (b: Branch) => b.maxX - b.minX;
  const ceilGrid = (v: number) => Math.ceil(v / GRID) * GRID;
  const groups = new Map<number, Branch[]>();
  for (const b of branches) (groups.get(b.section) ?? groups.set(b.section, []).get(b.section)!).push(b);
  for (const list of groups.values()) list.sort((a, b) => a.minX - b.minX);

  // Ancho de cada grupo y posición de inicio.
  const needOf = (list: Branch[]) => list.reduce((s, b) => s + ceilGrid(width(b)) + GAP, 0);
  let length: number;
  const startOf = new Map<number, number>();
  if (isMcc) {
    const n = mccLayout(bus.params).sections;
    const cw = Math.max(110, ...[...groups.values()].map((l) => needOf(l) + 16));
    length = 8 + n * cw;
    for (let k = 1; k <= n; k++) startOf.set(k, bn.x + 4 + (k - 1) * cw + 12);
  } else {
    startOf.set(1, bn.x + 16);
    length = needOf(groups.get(1)!) + 24;
  }
  // La barra no se acorta por debajo de su símbolo ni deja fuera a su alimentación.
  length = Math.max(length, isMcc ? 0 : 160, ...feederXs.map((x) => x - bn.x + 40));

  let p = project;
  for (const [k, list] of groups) {
    let cursor = startOf.get(k) ?? bn.x + 16;
    for (const b of list) {
      const dx = Math.round((cursor - b.minX) / GRID) * GRID;
      for (const id of b.ids) {
        const nn = p.diagram.nodes[id]!;
        if (dx) p = moveElement(p, id, nn.x + dx, nn.y);
      }
      cursor = b.maxX + dx + GAP;
      cursor = Math.max(cursor, b.minX + dx + ceilGrid(width(b)) + GAP);
    }
  }
  const cur = p.diagram.nodes[busId]!;
  return resizeBus(p, busId, ceilGrid(length), cur.x, cur.y);
}
