import type { ElementRegistry, ElementTypeDefinition, InternalLink, PortDef, Project, ProjectElement } from "@rea/core";
import { DEFAULT_EQUIPMENT_VOLTAGE, type EquipmentVoltageCriteria } from "../norm-module";
import { DisjointSets } from "./dsu";

/**
 * Validación de topología previa al cálculo (fase 1: redes radiales).
 *
 * Revisa, sin calcular corrientes:
 * 1. Puertos sin conectar.
 * 2. Energización: qué elementos quedan alimentados por una fuente, considerando el estado de
 *    interruptores y la posición de los ATS; distingue "sin fuente" de "desenergizado por maniobra".
 * 3. Fuentes en paralelo y lazos (red mallada): no soportados por el barrido radial de la fase 1.
 * 4. Alimentación en sentido inverso de transformadores, UPS y variadores.
 * 5. Compatibilidad de tensiones y sistemas entre elementos conectados (zonas de tensión).
 */

export type IssueCode =
  | "tipo-desconocido"
  | "puerto-sin-conectar"
  | "sin-fuente"
  | "desenergizado"
  | "fuentes-en-paralelo"
  | "lazo"
  | "alimentacion-inversa"
  | "tension-incompatible"
  | "sistema-incompatible"
  | "tension-fuera-de-tolerancia";

export interface TopologyIssue {
  code: IssueCode;
  severity: "error" | "warning";
  message: string;
  /** Elementos involucrados (para marcarlos en el diagrama). */
  elementIds: string[];
}

export interface TopologyReport {
  issues: TopologyIssue[];
  /** Elementos alimentados por alguna fuente con el estado actual de maniobras. */
  energized: Set<string>;
  /** Fuente que alimenta a cada elemento energizado (id del elemento fuente). */
  sourceOf: Map<string, string>;
}

/** Diferencia máxima entre tensiones nominales de elementos de distribución en la misma zona. */
export const DISTRIBUTION_MATCH_TOLERANCE = 0.01;

const SEP = "\u0000";
const pk = (elementId: string, portId: string) => `${elementId}${SEP}${portId}`;
const elementOf = (portKey: string) => portKey.split(SEP)[0]!;

function linkActive(link: InternalLink, el: ProjectElement): boolean {
  if (!link.when) return true;
  const v = el.params[link.when.param] ?? null;
  const e = link.when.equals;
  return Array.isArray(e) ? e.includes(v) : v === e;
}

const phasesOf = (system: string | null) => (system?.startsWith("3F") ? 3 : system?.startsWith("1F") ? 1 : null);
const hasNeutral = (system: string | null) => system === "3F4H" || system === "1F3H" || system === "1F2H";

interface Ctx {
  project: Project;
  registry: ElementRegistry;
  els: { el: ProjectElement; def: ElementTypeDefinition }[];
  tag: (id: string) => string;
}

export function validateTopology(
  project: Project,
  registry: ElementRegistry,
  equipment: EquipmentVoltageCriteria = DEFAULT_EQUIPMENT_VOLTAGE,
): TopologyReport {
  const issues: TopologyIssue[] = [];
  const els: Ctx["els"] = [];
  for (const el of project.elements) {
    const def = registry.tryGet(el.type);
    if (!def) issues.push({ code: "tipo-desconocido", severity: "error", message: `${el.tag}: tipo de elemento desconocido "${el.type}".`, elementIds: [el.id] });
    else els.push({ el, def });
  }
  const tags = new Map(project.elements.map((e) => [e.id, e.tag]));
  const ctx: Ctx = { project, registry, els, tag: (id) => tags.get(id) ?? id };

  const unconnected = checkUnconnected(ctx, issues);
  const { energized, sourceOf } = checkEnergization(ctx, issues, unconnected);
  checkVoltages(ctx, issues, equipment);

  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  return { issues, energized, sourceOf };
}

// ---------------------------------------------------------------- 1. Puertos sin conectar

/** Devuelve los elementos que no tienen ninguna conexión. */
function checkUnconnected(ctx: Ctx, issues: TopologyIssue[]): Set<string> {
  const count = new Map<string, number>();
  for (const c of ctx.project.connections) {
    for (const r of [c.a, c.b]) count.set(pk(r.elementId, r.portId), (count.get(pk(r.elementId, r.portId)) ?? 0) + 1);
  }
  const isolated = new Set<string>();
  for (const { el, def } of ctx.els) {
    const free = def.ports.filter((p) => !count.get(pk(el.id, p.id)));
    if (free.length === def.ports.length) isolated.add(el.id);
    for (const port of free) {
      const severity = unconnectedSeverity(def, port);
      const what =
        def.electricalRole === "bus"
          ? `${el.tag}: el tablero o barra no tiene conexiones.`
          : def.ports.length === 1
            ? `${el.tag}: no está conectado.`
            : `${el.tag}: el puerto "${port.label}" no está conectado.`;
      issues.push({ code: "puerto-sin-conectar", severity, message: what, elementIds: [el.id] });
    }
  }
  return isolated;
}

function unconnectedSeverity(def: ElementTypeDefinition, port: PortDef): "error" | "warning" {
  if (def.electricalRole === "load" || def.electricalRole === "branch") return "error";
  // La entrada de un equipo con sentido de flujo (primario, entrada de UPS/variador) es obligatoria.
  if ((def.internalLinks ?? []).some((l) => l.directional && l.a === port.id)) return "error";
  // Fuentes sin conectar, salidas libres, interruptores de reserva y barras vacías: advertencia.
  return "warning";
}

// ---------------------------------------------------------------- 2-4. Energización, paralelos, lazos, sentido

function checkEnergization(ctx: Ctx, issues: TopologyIssue[], isolated: Set<string>) {
  const active = new DisjointSets();
  const all = new DisjointSets();
  const nodes = new DisjointSets();
  type Step = { to: string; reverse?: string }; // reverse: id del elemento si se recorre un enlace direccional al revés
  const adj = new Map<string, Step[]>();
  const addAdj = (a: string, s: Step) => (adj.get(a) ?? adj.set(a, []).get(a)!).push(s);

  for (const c of ctx.project.connections) {
    const a = pk(c.a.elementId, c.a.portId);
    const b = pk(c.b.elementId, c.b.portId);
    active.union(a, b);
    all.union(a, b);
    nodes.union(a, b);
    addAdj(a, { to: b });
    addAdj(b, { to: a });
  }

  const loopSets = new DisjointSets();
  const looped = new Set<string>();
  for (const { el, def } of ctx.els) {
    for (const link of def.internalLinks ?? []) {
      const a = pk(el.id, link.a);
      const b = pk(el.id, link.b);
      all.union(a, b);
      if (!linkActive(link, el)) continue;
      active.union(a, b);
      addAdj(a, { to: b });
      addAdj(b, { to: a, reverse: link.directional ? el.id : undefined });
      // Lazo: el enlace une dos nodos eléctricos que ya estaban unidos por otro camino.
      if (!loopSets.union(nodes.find(a), nodes.find(b))) looped.add(el.id);
    }
  }
  if (looped.size) {
    const list = [...looped].map(ctx.tag).join(", ");
    issues.push({
      code: "lazo",
      severity: "error",
      message: `Red mallada (lazo cerrado) en ${list}. La fase 1 solo calcula redes radiales: abra un interruptor o elimine la conexión redundante.`,
      elementIds: [...looped],
    });
  }

  // Fuentes por componente activo.
  const sources = ctx.els.filter(({ def }) => def.electricalRole === "source");
  const sourcesByRoot = new Map<string, string[]>();
  for (const { el, def } of sources) {
    for (const p of def.ports) {
      const root = active.find(pk(el.id, p.id));
      const list = sourcesByRoot.get(root) ?? [];
      if (!list.includes(el.id)) list.push(el.id);
      sourcesByRoot.set(root, list);
    }
  }
  for (const list of sourcesByRoot.values()) {
    if (list.length > 1) {
      issues.push({
        code: "fuentes-en-paralelo",
        severity: "error",
        message: `Fuentes en paralelo: ${list.map(ctx.tag).join(", ")} alimentan la misma red. La fase 1 no calcula fuentes en paralelo; use un ATS o abra un interruptor.`,
        elementIds: list,
      });
    }
  }

  // Elementos energizados y su fuente.
  const energized = new Set<string>();
  const sourceOf = new Map<string, string>();
  for (const { el, def } of ctx.els) {
    for (const p of def.ports) {
      const src = sourcesByRoot.get(active.find(pk(el.id, p.id)))?.[0];
      if (src) {
        energized.add(el.id);
        if (!sourceOf.has(el.id)) sourceOf.set(el.id, src);
      }
    }
  }
  const staticRoots = new Set<string>();
  for (const { el, def } of sources) for (const p of def.ports) staticRoots.add(all.find(pk(el.id, p.id)));

  for (const { el, def } of ctx.els) {
    if (energized.has(el.id) || isolated.has(el.id)) continue;
    const reachable = def.ports.some((p) => staticRoots.has(all.find(pk(el.id, p.id))));
    issues.push(
      reachable
        ? { code: "desenergizado", severity: "warning", message: `${el.tag}: queda desenergizado por un interruptor abierto o la posición de un ATS.`, elementIds: [el.id] }
        : { code: "sin-fuente", severity: "error", message: `${el.tag}: no tiene una fuente que lo alimente.`, elementIds: [el.id] },
    );
  }

  // Sentido de alimentación: recorrido desde cada fuente.
  const reversed = new Set<string>();
  const seen = new Set<string>();
  for (const { el, def } of sources) {
    const queue = def.ports.map((p) => pk(el.id, p.id)).filter((k) => !seen.has(k));
    queue.forEach((k) => seen.add(k));
    while (queue.length) {
      const cur = queue.shift()!;
      for (const step of adj.get(cur) ?? []) {
        if (seen.has(step.to)) continue;
        if (step.reverse) reversed.add(step.reverse);
        seen.add(step.to);
        queue.push(step.to);
      }
    }
  }
  for (const id of reversed) {
    issues.push({
      code: "alimentacion-inversa",
      severity: "warning",
      message: `${ctx.tag(id)}: está alimentado en sentido inverso (por su secundario o salida). Verifique la orientación de las conexiones.`,
      elementIds: [id],
    });
  }

  return { energized, sourceOf };
}

// ---------------------------------------------------------------- 5. Tensiones

interface Decl {
  elementId: string;
  role: ElementTypeDefinition["electricalRole"];
  isMotor: boolean;
  dist: boolean;
  v: number;
  system: string | null;
  phase: string | null;
}

const DIST_PRIORITY: Record<string, number> = { source: 0, transformer: 1, converter: 2, bus: 3 };

function checkVoltages(ctx: Ctx, issues: TopologyIssue[], equipment: EquipmentVoltageCriteria) {
  const zones = new DisjointSets();
  for (const c of ctx.project.connections) zones.union(pk(c.a.elementId, c.a.portId), pk(c.b.elementId, c.b.portId));
  for (const { el, def } of ctx.els) {
    if (!def.voltageTransparent) continue;
    for (const l of def.internalLinks ?? []) zones.union(pk(el.id, l.a), pk(el.id, l.b));
  }

  const byZone = new Map<string, Decl[]>();
  for (const { el, def } of ctx.els) {
    for (const port of def.ports) {
      if (!port.voltage) continue;
      const v = el.params[port.voltage.param];
      if (typeof v !== "number" || !(v > 0)) continue;
      const system = port.voltage.system ? ((el.params[port.voltage.system] as string | null) ?? null) : null;
      const phase = port.voltage.phase ? ((el.params[port.voltage.phase] as string | null) ?? null) : null;
      const isOutput = (def.internalLinks ?? []).some((l) => l.directional && l.b === port.id);
      // Declaraciones "de distribución" fijan la tensión de la zona; la entrada de un convertidor se trata como carga.
      const dist = def.electricalRole in DIST_PRIORITY && (def.electricalRole !== "converter" || isOutput);
      const root = zones.find(pk(el.id, port.id));
      const isMotor = def.calcBehavior === "load.motor";
      (byZone.get(root) ?? byZone.set(root, []).get(root)!).push({ elementId: el.id, role: def.electricalRole, isMotor, dist, v, system, phase });
    }
  }

  const fmtV = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)} V`;

  for (const decls of byZone.values()) {
    const dists = decls.filter((d) => d.dist).sort((a, b) => DIST_PRIORITY[a.role]! - DIST_PRIORITY[b.role]!);
    const ref = dists[0];
    if (!ref) continue;

    for (const d of dists.slice(1)) {
      if (d.elementId === ref.elementId) continue;
      if (Math.abs(d.v - ref.v) / ref.v > DISTRIBUTION_MATCH_TOLERANCE) {
        issues.push({
          code: "tension-incompatible",
          severity: "error",
          message: `${ctx.tag(d.elementId)} (${fmtV(d.v)}) está conectado a ${ctx.tag(ref.elementId)} (${fmtV(ref.v)}): tensiones nominales distintas.`,
          elementIds: [d.elementId, ref.elementId],
        });
      } else if (phasesOf(d.system) !== null && phasesOf(ref.system) !== null && phasesOf(d.system) !== phasesOf(ref.system)) {
        issues.push({
          code: "sistema-incompatible",
          severity: "error",
          message: `${ctx.tag(d.elementId)} (${d.system}) está conectado a ${ctx.tag(ref.elementId)} (${ref.system}): número de fases distinto.`,
          elementIds: [d.elementId, ref.elementId],
        });
      } else if (d.system === "3F4H" && ref.system === "3F3H") {
        issues.push({
          code: "sistema-incompatible",
          severity: "error",
          message: `${ctx.tag(d.elementId)} es de 4 hilos pero ${ctx.tag(ref.elementId)} entrega un sistema de 3 hilos (sin neutro).`,
          elementIds: [d.elementId, ref.elementId],
        });
      }
    }

    for (const d of decls.filter((x) => !x.dist)) {
      const r = expectedLoadVoltage(d, ref);
      if ("error" in r) {
        issues.push({ code: "sistema-incompatible", severity: "error", message: `${ctx.tag(d.elementId)}: ${r.error}`, elementIds: [d.elementId] });
        continue;
      }
      // La tolerancia de los fabricantes se expresa respecto a la tensión de PLACA del equipo.
      const tol = d.isMotor ? equipment.motor : equipment.other;
      const dev = (r.v - d.v) / d.v;
      const abs = Math.abs(dev) * 100;
      if (abs > tol.continuousPct) {
        const sign = dev > 0 ? "+" : "−";
        issues.push({
          code: "tension-fuera-de-tolerancia",
          severity: abs > tol.limitPct ? "error" : "warning",
          message:
            `${ctx.tag(d.elementId)}: tensión de placa ${fmtV(d.v)}; el sistema de ${ctx.tag(ref.elementId)} entrega ${fmtV(Math.round(r.v * 10) / 10)} ${r.how} ` +
            `(${sign}${abs.toFixed(1)} % respecto a la placa). ${abs > tol.limitPct ? `Excede ±${tol.limitPct} %` : `Fuera de ±${tol.continuousPct} %, dentro de ±${tol.limitPct} %`}: ${tol.source}.`,
          elementIds: [d.elementId],
        });
      }
    }
  }
}

/** Tensión que el sistema de referencia entrega a una carga según su sistema y fase de conexión. */
function expectedLoadVoltage(d: Decl, ref: Decl): { v: number; how: string } | { error: string } {
  const refPh = phasesOf(ref.system);
  const loadPh = phasesOf(d.system);
  const ll = { v: ref.v, how: "entre fases" };

  if (loadPh === 3) {
    if (refPh === 1) return { error: `carga trifásica conectada a un sistema monofásico (${ref.system}).` };
    if (d.system === "3F4H" && !hasNeutral(ref.system)) return { error: "la carga requiere neutro (4 hilos) y el sistema es de 3 hilos." };
    return ll;
  }
  if (loadPh === null) return ll; // p. ej. entrada de variador: se compara contra la tensión entre fases.

  // Carga monofásica.
  const p = d.phase ?? "";
  if (refPh === 3) {
    if (p === "ABC") return { error: "carga monofásica con conexión trifásica: indique la fase o el par de fases." };
    if (["A", "B", "C"].includes(p)) {
      if (!hasNeutral(ref.system)) return { error: `conexión fase-neutro (${p}-N) en un sistema sin neutro (${ref.system}).` };
      return { v: ref.v / Math.sqrt(3), how: "fase-neutro" };
    }
    return ll;
  }
  if (ref.system === "1F3H") {
    if (["A", "B"].includes(p)) return { v: ref.v / 2, how: "fase-neutro" };
    if (p === "AB") return ll;
    return { error: `la fase "${p}" no existe en un sistema monofásico de 3 hilos (use A, B o A-B).` };
  }
  if (d.system === "1F3H") return { error: "carga de 3 hilos conectada a un sistema monofásico de 2 hilos." };
  return ll;
}
