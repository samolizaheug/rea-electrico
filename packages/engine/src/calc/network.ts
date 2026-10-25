import type { ElementRegistry, ElementTypeDefinition, InternalLink, Project, ProjectElement } from "@rea/core";
import { DisjointSets } from "../topology/dsu";

/**
 * Red radial derivada del modelo, lista para el flujo de carga.
 *
 * - Un NODO es un conjunto de puertos unidos por conexiones (impedancia nula).
 * - Una RAMA es un elemento con una conexión interna activa entre dos puertos
 *   (cable, interruptor cerrado, ATS en su posición, transformador, UPS, variador).
 * - Las CARGAS, FUENTES y BARRAS cuelgan de un nodo.
 *
 * Cada nodo lleva su "tensión de circuito" (Vc):
 * - nodos trifásicos (m = 3): Vc = tensión de fase a neutro equivalente, V_LL / √3;
 * - nodos monofásicos (m = 1): Vc = tensión entre los dos conductores del circuito.
 * Los circuitos derivados monofásicos que salen de un tablero trifásico forman nodos m = 1
 * con k = 2 (corriente de ida y vuelta por dos conductores).
 */

export interface NetNode {
  id: string;
  /** Tensión nominal entre fases de la zona (V). */
  vNomLL: number;
  system: string | null;
  /** 3 = circuito trifásico equilibrado; 1 = circuito monofásico de dos conductores. */
  m: 3 | 1;
  /** Tensión nominal del circuito, Vc (ver arriba). */
  vcNom: number;
  /** Conexión del circuito monofásico respecto a la zona: fase-neutro o entre fases. */
  circuit?: { connection: "LN" | "LL"; phase: string };
  loads: string[];
  buses: string[];
  sources: string[];
}

export interface NetEdge {
  elementId: string;
  role: ElementTypeDefinition["electricalRole"];
  parent: string;
  child: string;
  /** Puerto del elemento del lado de la fuente. */
  fromPort: string;
  toPort: string;
  /** true si se recorre en sentido inverso al de su conexión interna direccional. */
  reverse: boolean;
}

export interface Island {
  sourceId: string;
  root: string;
  /** Nodos en orden de recorrido desde la fuente (padres antes que hijos). */
  order: string[];
  nodes: Map<string, NetNode>;
  /** Rama que alimenta a cada nodo (no existe para la raíz). */
  parentEdge: Map<string, NetEdge>;
  children: Map<string, NetEdge[]>;
}

const SEP = "\u0000";
const pk = (el: string, port: string) => `${el}${SEP}${port}`;

function linkActive(link: InternalLink, el: ProjectElement): boolean {
  if (!link.when) return true;
  const v = el.params[link.when.param] ?? null;
  const e = link.when.equals;
  return Array.isArray(e) ? e.includes(v) : v === e;
}

const num = (v: unknown) => (typeof v === "number" ? v : NaN);
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Construye una isla radial por cada fuente. Supone que la topología ya se validó (sin lazos ni paralelos). */
export function buildIslands(project: Project, registry: ElementRegistry): Island[] {
  const els = new Map(project.elements.map((e) => [e.id, e]));
  const defOf = (id: string) => registry.get(els.get(id)!.type);

  const dsu = new DisjointSets();
  for (const e of project.elements) for (const p of registry.tryGet(e.type)?.ports ?? []) dsu.find(pk(e.id, p.id));
  for (const c of project.connections) dsu.union(pk(c.a.elementId, c.a.portId), pk(c.b.elementId, c.b.portId));
  const nodeOf = (el: string, port: string) => dsu.find(pk(el, port));

  // Ramas activas por nodo.
  type Adj = { elementId: string; link: InternalLink; fromPort: string; toPort: string; other: string };
  const adj = new Map<string, Adj[]>();
  const attach = new Map<string, { loads: string[]; buses: string[]; sources: string[] }>();
  const att = (n: string) => attach.get(n) ?? attach.set(n, { loads: [], buses: [], sources: [] }).get(n)!;
  for (const e of project.elements) {
    const def = registry.tryGet(e.type);
    if (!def) continue;
    for (const link of def.internalLinks ?? []) {
      if (!linkActive(link, e)) continue;
      const a = nodeOf(e.id, link.a);
      const b = nodeOf(e.id, link.b);
      (adj.get(a) ?? adj.set(a, []).get(a)!).push({ elementId: e.id, link, fromPort: link.a, toPort: link.b, other: b });
      (adj.get(b) ?? adj.set(b, []).get(b)!).push({ elementId: e.id, link, fromPort: link.b, toPort: link.a, other: a });
    }
    if (def.ports.length === 1) {
      const n = nodeOf(e.id, def.ports[0]!.id);
      if (def.electricalRole === "load") att(n).loads.push(e.id);
      else if (def.electricalRole === "bus") att(n).buses.push(e.id);
      else if (def.electricalRole === "source") att(n).sources.push(e.id);
    }
  }

  const islands: Island[] = [];
  for (const src of project.elements) {
    const def = registry.tryGet(src.type);
    if (def?.electricalRole !== "source") continue;
    const root = nodeOf(src.id, def.ports[0]!.id);
    const nodes = new Map<string, NetNode>();
    const parentEdge = new Map<string, NetEdge>();
    const children = new Map<string, NetEdge[]>();
    const system = str(src.params.system);
    const mk = (id: string, vNomLL: number, sys: string | null): NetNode => {
      const a = attach.get(id) ?? { loads: [], buses: [], sources: [] };
      const m = sys?.startsWith("1F") ? 1 : 3;
      return { id, vNomLL, system: sys, m, vcNom: m === 3 ? vNomLL / Math.sqrt(3) : vNomLL, loads: [...a.loads], buses: [...a.buses], sources: [...a.sources] };
    };
    nodes.set(root, mk(root, num(src.params.voltageV), system));
    const order = [root];
    for (let i = 0; i < order.length; i++) {
      const cur = order[i]!;
      const curNode = nodes.get(cur)!;
      for (const a of adj.get(cur) ?? []) {
        if (nodes.has(a.other) || parentEdge.get(cur)?.elementId === a.elementId) continue;
        const el = els.get(a.elementId)!;
        const edef = defOf(a.elementId);
        const reverse = !!a.link.directional && a.fromPort === a.link.b;
        let vNom = curNode.vNomLL;
        let sys = curNode.system;
        if (edef.electricalRole === "transformer") {
          const toSecondary = !reverse;
          vNom = num(toSecondary ? el.params.secondaryVoltageV : el.params.primaryVoltageV);
          sys = str(toSecondary ? el.params.system : el.params.primarySystem);
        } else if (edef.electricalRole === "converter") {
          const outV = el.params.outputVoltageV ?? el.params.inputVoltageV;
          vNom = num(outV);
          sys = str(el.params.system) ?? curNode.system;
        }
        nodes.set(a.other, mk(a.other, vNom, sys));
        const edge: NetEdge = { elementId: a.elementId, role: edef.electricalRole, parent: cur, child: a.other, fromPort: a.fromPort, toPort: a.toPort, reverse };
        parentEdge.set(a.other, edge);
        (children.get(cur) ?? children.set(cur, []).get(cur)!).push(edge);
        order.push(a.other);
      }
    }
    markSingleCircuits(order, nodes, parentEdge, children, (id) => els.get(id)!);
    islands.push({ sourceId: src.id, root, order, nodes, parentEdge, children });
  }
  return islands;
}

/**
 * Detecta circuitos derivados monofásicos que salen de un nodo trifásico (o de un sistema
 * monofásico de 3 hilos hacia una carga fase-neutro) y los marca como nodos m = 1.
 * Un subárbol es un circuito monofásico si no contiene barras y todas sus cargas son
 * monofásicas con la misma conexión de fases.
 */
function markSingleCircuits(
  order: string[],
  nodes: Map<string, NetNode>,
  parentEdge: Map<string, NetEdge>,
  children: Map<string, NetEdge[]>,
  el: (id: string) => ProjectElement,
) {
  const subtree = (n: string): { loads: string[]; hasBus: boolean; hasConverter: boolean } => {
    const node = nodes.get(n)!;
    const out = { loads: [...node.loads], hasBus: node.buses.length > 0, hasConverter: false };
    for (const e of children.get(n) ?? []) {
      if (e.role === "transformer") out.hasBus = true; // un transformador separa zonas: no es circuito derivado
      if (e.role === "converter") out.hasConverter = true;
      const s = subtree(e.child);
      out.loads.push(...s.loads);
      out.hasBus ||= s.hasBus;
      out.hasConverter ||= s.hasConverter;
    }
    return out;
  };

  for (const id of order) {
    const pe = parentEdge.get(id);
    if (!pe) continue;
    const parent = nodes.get(pe.parent)!;
    const node = nodes.get(id)!;
    if (node.circuit || pe.role === "transformer" || pe.role === "converter") continue;
    if (parent.circuit) {
      // Continúa el circuito monofásico del padre (p. ej. interruptor → cable → carga).
      Object.assign(node, { m: 1, vcNom: parent.vcNom, circuit: parent.circuit });
      continue;
    }
    if (parent.m === 1 && parent.system !== "1F3H") continue; // ya es circuito monofásico de 2 hilos
    const st = subtree(id);
    if (st.hasBus || st.hasConverter || st.loads.length === 0) continue;
    const phases = new Set<string>();
    let allSingle = true;
    for (const l of st.loads) {
      const sys = el(l).params.system;
      if (typeof sys !== "string" || !sys.startsWith("1F")) allSingle = false;
      phases.add(String(el(l).params.phase ?? ""));
    }
    if (!allSingle || phases.size !== 1) continue;
    const phase = [...phases][0]!;
    const ln = ["A", "B", "C"].includes(phase);
    let vc: number;
    if (parent.m === 3) vc = ln ? parent.vNomLL / Math.sqrt(3) : parent.vNomLL;
    else vc = ln ? parent.vNomLL / 2 : parent.vNomLL; // sistema 1F3H: fase-neutro = V/2
    Object.assign(node, { m: 1, vcNom: vc, circuit: { connection: ln ? "LN" : "LL", phase } });
  }
}
