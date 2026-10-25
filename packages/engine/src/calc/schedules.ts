import type { ElementRegistry, Project, ProjectElement } from "@rea/core";
import type { LoadFlowResult } from "./loadflow";
import { buildIslands, type Island, type NetEdge } from "./network";
import type { SizingRunResult } from "./sizing";

/**
 * Cuadros de carga por tablero: un renglón por circuito de salida, con la potencia demandada
 * repartida por fase y los datos de protección y conductor; totales, corriente por fase y desbalance.
 *
 * Reparto por fase:
 * - Carga trifásica: un tercio en cada fase.
 * - Monofásica fase-neutro (A, B, C): toda en su fase.
 * - Monofásica entre fases (A-B, B-C, C-A): la mitad en cada una de las dos fases.
 * - Tableros derivados: con su propio reparto (se suman sus cargas aguas abajo).
 * - Transformadores, variadores y UPS: su potencia de entrada, equilibrada en tres fases (aproximación).
 * Desbalance = (F_máx − F_mín) / F_máx · 100, con F = potencia por fase (criterio de práctica común; la NOM no fija un valor).
 */

export interface PhaseVA {
  a: number;
  b: number;
  c: number;
}

export interface ScheduleRow {
  /** Elemento que encabeza el circuito (normalmente el interruptor). */
  headId: string;
  circuit: string;
  description: string;
  phases: string;
  poles?: number;
  va: PhaseVA;
  totalVA: number;
  pKW: number;
  qKvar: number;
  currentA?: number;
  protectionA?: number;
  conductor?: string;
  lengthM?: number;
  dropPct?: number;
}

export interface PanelSchedule {
  boardId: string;
  tag: string;
  vNomLL: number;
  system: string | null;
  rows: ScheduleRow[];
  totals: {
    va: PhaseVA;
    totalVA: number;
    pKW: number;
    qKvar: number;
    pf: number;
    currentA: PhaseVA;
    unbalancePct: number;
  };
  notes: string[];
}

const n = (v: unknown, fb = NaN) => (typeof v === "number" ? v : fb);
const add = (x: PhaseVA, y: PhaseVA): PhaseVA => ({ a: x.a + y.a, b: x.b + y.b, c: x.c + y.c });
const ZERO: PhaseVA = { a: 0, b: 0, c: 0 };

function splitByPhase(va: number, system: string | null, phase: string): PhaseVA {
  if (!system?.startsWith("1F") || phase === "ABC") return { a: va / 3, b: va / 3, c: va / 3 };
  const parts = phase.split("").filter((p) => "ABC".includes(p));
  const each = va / Math.max(1, parts.length);
  return { a: parts.includes("A") ? each : 0, b: parts.includes("B") ? each : 0, c: parts.includes("C") ? each : 0 };
}

export function panelSchedules(project: Project, registry: ElementRegistry, flow: LoadFlowResult, sizing?: SizingRunResult): PanelSchedule[] {
  const p = sizing?.sizedProject ?? project;
  const els = new Map(p.elements.map((e) => [e.id, e]));
  const defOf = (id: string) => registry.get(els.get(id)!.type);
  const out: PanelSchedule[] = [];
  let hasTransformerRow = false;

  for (const island of buildIslands(p, registry)) {
    for (const nodeId of island.order) {
      const node = island.nodes.get(nodeId)!;
      if (!node.buses.length) continue;
      const board = els.get(node.buses[0]!)!;
      const rows: ScheduleRow[] = [];

      for (const lid of node.loads) rows.push(loadRow(els.get(lid)!, flow, lid));
      for (const e of island.children.get(nodeId) ?? []) {
        const { va, tags, phases, balancedEquipment } = downstream(e, island, els, defOf, flow);
        if (balancedEquipment) hasTransformerRow = true;
        const headFlow = flow.elements.get(e.elementId);
        const cable = firstCable(e, island, defOf);
        const cableEl = cable ? els.get(cable)! : undefined;
        const circ = cable ? sizing?.circuits.get(cable) : undefined;
        const cableFlow = cable ? flow.elements.get(cable) : undefined;
        const head = els.get(e.elementId)!;
        const size = circ?.conductor.designation ?? (typeof cableEl?.params.forcedSize === "string" ? cableEl.params.forcedSize : undefined);
        const npar = n(cableEl?.params.conductorsPerPhase, 1);
        const conductor = size && size !== "—" ? `${npar > 1 ? `${npar} × ` : ""}${size}${circ?.conductor.egc ? ` + ${circ.conductor.egc.designation} T` : ""}` : undefined;
        const prot = circ?.protection.ratingA ?? (defOf(e.elementId).calcBehavior === "switch.protective" ? n(head.params.forcedRatingA) : NaN);
        const totalVA = va.a + va.b + va.c;
        rows.push({
          headId: e.elementId,
          circuit: head.tag,
          description: tags.join(", "),
          phases,
          poles: defOf(e.elementId).calcBehavior === "switch.protective" ? Number(head.params.poles ?? 3) : undefined,
          va,
          totalVA,
          pKW: headFlow?.power?.pKW ?? totalVA / 1000,
          qKvar: headFlow?.power?.qKvar ?? 0,
          currentA: cableFlow?.currentA ?? headFlow?.currentA,
          protectionA: Number.isFinite(prot) ? prot : undefined,
          conductor,
          lengthM: cableEl ? n(cableEl.params.lengthM) : undefined,
          dropPct: cableFlow?.dropPct,
        });
      }

      const va = rows.reduce((s, r) => add(s, r.va), ZERO);
      const totalVA = va.a + va.b + va.c;
      const pKW = rows.reduce((s, r) => s + r.pKW, 0);
      const qKvar = rows.reduce((s, r) => s + r.qKvar, 0);
      const vln = node.vNomLL / Math.sqrt(3);
      const max = Math.max(va.a, va.b, va.c);
      const min = Math.min(va.a, va.b, va.c);
      const notes = [
        "Potencia demandada (con el factor de demanda capturado en cada carga).",
        "Desbalance = (F_máx − F_mín) / F_máx · 100; criterio de práctica común, la NOM no fija un valor.",
      ];
      if (hasTransformerRow) notes.push("Transformadores, variadores y UPS se reparten equilibrados en sus tres fases de entrada.");
      out.push({
        boardId: board.id,
        tag: board.tag,
        vNomLL: node.vNomLL,
        system: node.system,
        rows,
        totals: {
          va,
          totalVA,
          pKW,
          qKvar,
          pf: Math.hypot(pKW, qKvar) > 0 ? pKW / Math.hypot(pKW, qKvar) : 1,
          currentA: { a: va.a / vln, b: va.b / vln, c: va.c / vln },
          unbalancePct: max > 0 ? ((max - min) / max) * 100 : 0,
        },
        notes,
      });
      hasTransformerRow = false;
    }
  }
  return out;
}

function loadRow(el: ProjectElement, flow: LoadFlowResult, id: string): ScheduleRow {
  const f = flow.elements.get(id);
  const va = (f?.power?.sKVA ?? 0) * 1000;
  const phase = String(el.params.phase ?? "ABC");
  const system = typeof el.params.system === "string" ? el.params.system : null;
  const split = splitByPhase(va, system, phase);
  return { headId: id, circuit: el.tag, description: el.tag, phases: system?.startsWith("1F") ? phase : "ABC", va: split, totalVA: va, pKW: f?.power?.pKW ?? 0, qKvar: f?.power?.qKvar ?? 0, currentA: f?.currentA };
}

/** Primer cable en el camino de un circuito de salida. */
function firstCable(e: NetEdge, island: Island, defOf: (id: string) => ReturnType<ElementRegistry["get"]>): string | undefined {
  if (defOf(e.elementId).calcBehavior === "branch.cable") return e.elementId;
  if (e.role !== "switch") return undefined;
  const next = island.children.get(e.child) ?? [];
  return next.length === 1 ? firstCable(next[0]!, island, defOf) : undefined;
}

/** Potencia por fase y etiquetas de lo que alimenta un circuito de salida. */
function downstream(
  e: NetEdge,
  island: Island,
  els: Map<string, ProjectElement>,
  defOf: (id: string) => ReturnType<ElementRegistry["get"]>,
  flow: LoadFlowResult,
): { va: PhaseVA; tags: string[]; phases: string; balancedEquipment: boolean } {
  if (e.role === "transformer" || e.role === "converter") {
    const s = (flow.elements.get(e.elementId)?.power?.sKVA ?? 0) * 1000;
    return { va: { a: s / 3, b: s / 3, c: s / 3 }, tags: [els.get(e.elementId)!.tag], phases: "ABC", balancedEquipment: true };
  }
  let balancedEquipment = false;
  let va = ZERO;
  const tags: string[] = [];
  const used = new Set<string>();
  const walk = (nodeId: string) => {
    const node = island.nodes.get(nodeId)!;
    for (const b of node.buses) tags.push(els.get(b)!.tag);
    for (const lid of node.loads) {
      const el = els.get(lid)!;
      const r = loadRow(el, flow, lid);
      va = add(va, r.va);
      if (!node.buses.length) tags.push(el.tag);
      for (const ph of ["a", "b", "c"] as const) if (r.va[ph] > 0) used.add(ph.toUpperCase());
    }
    for (const ce of island.children.get(nodeId) ?? []) {
      if (ce.role === "transformer" || ce.role === "converter") {
        const d = downstream(ce, island, els, defOf, flow);
        va = add(va, d.va);
        balancedEquipment = true;
        if (!node.buses.length) tags.push(...d.tags);
        ["A", "B", "C"].forEach((x) => used.add(x));
      } else walk(ce.child);
    }
  };
  walk(e.child);
  const phases = ["A", "B", "C"].filter((x) => used.has(x)).join("") || "ABC";
  return { va, tags, phases, balancedEquipment };
}
