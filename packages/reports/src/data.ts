import type { ElementRegistry, Project } from "@rea/core";
import { buildIslands, type ElementFlow, type Island, type PanelSchedule, type SizingRunResult, type Trace } from "@rea/engine";
import { getNormDataset, type VerificationStatus } from "@rea/norm-data";
import { rs, type ReportStringKey } from "./strings";

/**
 * Datos que comparten todos los reportes. Se arman a partir del resultado del motor
 * (método nominal), igual que lo que se ve en pantalla.
 */
export interface ReportIssue {
  severity: "error" | "warning" | "info";
  message: string;
  elementIds?: string[];
}

/** Severidad más alta por elemento (para colorear el unifilar). */
export function issueSeverityByElement(issues: ReportIssue[]): Map<string, "error" | "warning"> {
  const out = new Map<string, "error" | "warning">();
  for (const i of issues) {
    if (i.severity === "info") continue;
    for (const id of i.elementIds ?? []) if (out.get(id) !== "error") out.set(id, i.severity);
  }
  return out;
}

export interface ReportInput {
  project: Project;
  registry: ElementRegistry;
  norm: { id: string; edition: string; label: string };
  sizing: SizingRunResult;
  schedules: PanelSchedule[];
  issues: ReportIssue[];
  /** Fecha de emisión (por defecto, ahora). */
  date?: Date;
}

/** Número con separador de miles y decimales fijos, en formato es-MX. "—" si no es finito. */
export function fmt(v: number | undefined, d = 1): string {
  return v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
}

// ---------------------------------------------------------------- Cédula de circuitos

export interface CircuitRow {
  cableId: string;
  tag: string;
  breakerTag?: string;
  from: string;
  to: string;
  kind: "alimentador" | "derivado";
  loadA: number;
  designA: number;
  rule: string;
  protectionA?: number;
  /** Calibre por fase, p. ej. "2 × 250 kcmil Cu". */
  conductor: string;
  egc?: string;
  ampacityA: number;
  lengthM?: number;
  dropPct?: number;
  cumulativePct?: number;
  governing: string;
}

function tagOf(project: Project, id: string): string {
  return project.elements.find((e) => e.id === id)?.tag ?? "?";
}

/** Equipo de origen de un nodo: la barra, la fuente o el transformador que lo alimenta. */
function originOf(island: Island, project: Project, nodeId: string): string {
  let id: string | undefined = nodeId;
  for (let guard = 0; id && guard < 1000; guard++) {
    const node = island.nodes.get(id)!;
    if (node.buses.length) return tagOf(project, node.buses[0]!);
    if (node.sources.length) return tagOf(project, node.sources[0]!);
    const pe = island.parentEdge.get(id);
    if (!pe) break;
    if (pe.role === "transformer" || pe.role === "converter") return tagOf(project, pe.elementId);
    id = pe.parent;
  }
  return "—";
}

/** Equipos que alimenta un nodo: barras, cargas o transformadores (lo primero que se encuentra). */
function destinationOf(island: Island, project: Project, nodeId: string): string[] {
  const node = island.nodes.get(nodeId)!;
  if (node.buses.length) return node.buses.map((b) => tagOf(project, b));
  const out = node.loads.map((l) => tagOf(project, l));
  for (const ce of island.children.get(nodeId) ?? []) {
    if (ce.role === "transformer" || ce.role === "converter") out.push(tagOf(project, ce.elementId));
    else out.push(...destinationOf(island, project, ce.child));
  }
  return out;
}

export function conductorLabel(c: { designation: string; system: string; conductorsPerPhase: number; material?: string }): string {
  if (c.designation === "—") return "—";
  const unit = c.system === "AWG" ? " AWG" : c.system === "kcmil" ? " kcmil" : c.system === "mm2" ? " mm²" : "";
  return `${c.conductorsPerPhase > 1 ? `${c.conductorsPerPhase} × ` : ""}${c.designation}${unit}${c.material ? ` ${c.material}` : ""}`;
}

export function circuitRows(input: ReportInput): CircuitRow[] {
  const { sizing } = input;
  const p = sizing.sizedProject;
  const rows: CircuitRow[] = [];
  const flow = (id: string) => sizing.loadFlow.elements.get(id);
  for (const island of buildIslands(p, input.registry)) {
    for (const nodeId of island.order) {
      const pe = island.parentEdge.get(nodeId);
      const c = pe ? sizing.circuits.get(pe.elementId) : undefined;
      if (!pe || !c) continue;
      const cable = p.elements.find((e) => e.id === c.cableId);
      const f = flow(c.cableId);
      rows.push({
        cableId: c.cableId,
        tag: c.tag,
        breakerTag: c.breakerId ? tagOf(p, c.breakerId) : undefined,
        from: originOf(island, p, pe.parent),
        to: destinationOf(island, p, pe.child).join(", ") || "—",
        kind: c.circuitKind,
        loadA: c.protection.loadA,
        designA: c.protection.designA,
        rule: c.protection.rule,
        protectionA: c.protection.ratingA,
        conductor: conductorLabel(c.conductor),
        egc: c.conductor.egc ? `${c.conductor.egc.designation}${c.conductor.egc.system === "AWG" ? " AWG" : c.conductor.egc.system === "kcmil" ? " kcmil" : ""}` : undefined,
        ampacityA: c.conductor.ampacityA,
        lengthM: typeof cable?.params.lengthM === "number" ? cable.params.lengthM : undefined,
        dropPct: f?.dropPct,
        cumulativePct: f?.cumulativeDropPct,
        governing: rs(`governing.${c.conductor.governing}` as ReportStringKey),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------- Resultados por elemento

/** Elementos en orden de la fuente hacia las cargas (los no conectados al final). */
export function elementOrder(input: ReportInput): string[] {
  const p = input.sizing.sizedProject;
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };
  for (const island of buildIslands(p, input.registry)) {
    for (const nodeId of island.order) {
      const pe = island.parentEdge.get(nodeId);
      if (pe) push(pe.elementId);
      const node = island.nodes.get(nodeId)!;
      [...node.sources, ...node.buses, ...node.loads].forEach(push);
    }
  }
  p.elements.forEach((e) => push(e.id));
  return out;
}

export interface ElementReport {
  id: string;
  tag: string;
  typeName: string;
  facts: [string, string][];
  traces: Trace[];
}

/** Datos y memoria de un elemento: lo mismo que muestra el inspector en "Resultados y memoria". */
export function elementReport(elementId: string, sizing: SizingRunResult, registry: ElementRegistry): ElementReport | null {
  const el = sizing.sizedProject.elements.find((e) => e.id === elementId);
  if (!el) return null;
  const flow: ElementFlow | undefined = sizing.loadFlow.elements.get(elementId);
  const circuit = sizing.circuits.get(elementId);
  const asBreaker = [...sizing.circuits.values()].find((c) => c.breakerId === elementId);
  if (!flow && !circuit && !asBreaker) return null;

  const facts: [string, string][] = [];
  if (flow?.currentA !== undefined) facts.push([rs("current"), `${fmt(flow.currentA, 2)} A`]);
  if (flow?.currentSecondaryA !== undefined) facts.push([rs("currentSecondary"), `${fmt(flow.currentSecondaryA, 2)} A`]);
  if (flow?.power) facts.push([rs("power"), `${fmt(flow.power.pKW, 3)} kW · ${fmt(flow.power.qKvar, 3)} kvar · ${fmt(flow.power.sKVA, 3)} kVA · FP ${fmt(flow.power.pf, 3)}`]);
  if (flow?.voltage) facts.push([rs("voltage"), `${fmt(flow.voltage.v, 1)} V (${fmt(flow.voltage.pct, 2)} % de ${fmt(flow.voltage.vNom, 1)} V ${flow.voltage.basis})`]);
  if (flow?.dropPct !== undefined) facts.push([rs("drop"), `${fmt(flow.dropPct, 3)} %`]);
  if (flow?.cumulativeDropPct !== undefined) facts.push([rs("cumulative"), `${fmt(flow.cumulativeDropPct, 3)} %`]);
  if (circuit) {
    const c = circuit.conductor;
    facts.push([rs("designCurrent"), `${fmt(circuit.protection.designA, 2)} A (${circuit.protection.rule})`]);
    facts.push([rs("conductor"), `${conductorLabel(c)} — ${fmt(c.ampacityA, 1)} A (${rs("governing").toLowerCase()}: ${rs(`governing.${c.governing}` as ReportStringKey)})`]);
    if (c.egc) facts.push([rs("egc"), `${c.egc.designation} ${c.egc.system}${c.egc.perRaceway ? " en cada canalización" : ""}`]);
    if (circuit.protection.ratingA !== undefined) facts.push([rs("protection").replace(" (A)", ""), `${circuit.protection.ratingA} A`]);
  }
  if (asBreaker) facts.push([rs("protection").replace(" (A)", ""), `${asBreaker.protection.ratingA ?? "—"} A (${asBreaker.protection.rule})`]);

  const traces: Trace[] = [
    ...(circuit ? [{ title: rs("sizingTrace"), steps: [...circuit.protection.steps, ...circuit.conductor.steps] }] : []),
    ...(asBreaker ? [{ title: rs("protectionTrace"), steps: asBreaker.protection.steps }] : []),
    ...(flow?.traces ?? []),
  ];
  return { id: elementId, tag: el.tag, typeName: registry.tryGet(el.type)?.name ?? el.type, facts, traces };
}

export function elementReports(input: ReportInput): ElementReport[] {
  return elementOrder(input)
    .map((id) => elementReport(id, input.sizing, input.registry))
    .filter((r): r is ElementReport => !!r);
}

/** Resumen corto de resultados para mostrar junto al símbolo en el diagrama. */
export function resultBadge(elementId: string, type: string, sizing: SizingRunResult): string[] {
  const flow = sizing.loadFlow.elements.get(elementId);
  const circuit = sizing.circuits.get(elementId);
  switch (type) {
    case "cable": {
      if (!flow) return [];
      const size = circuit && circuit.conductor.designation !== "—" ? conductorLabel({ ...circuit.conductor, material: undefined }).replace(" × ", "×") : "sin calibre";
      return [size, `${fmt(flow.currentA)} A · ΔV ${fmt(flow.dropPct, 2)} %`];
    }
    case "breaker": {
      const r = [...sizing.circuits.values()].find((c) => c.breakerId === elementId)?.protection.ratingA;
      return r !== undefined ? [`${r} A`] : [];
    }
    case "transformer":
      return flow ? [`${fmt(flow.power?.sKVA)} kVA`, `ΔV ${fmt(flow.dropPct, 2)} %`] : [];
    case "panelboard":
    case "mcc":
    case "busbar":
      return flow?.voltage ? [`${fmt(flow.voltage.v)} V (${fmt(flow.voltage.pct, 2)} %)`] : [];
    case "utility":
    case "generator":
      return flow ? [`${fmt(flow.power?.sKVA)} kVA · ${fmt(flow.currentA)} A`] : [];
    default:
      if (!flow) return [];
      return [`${fmt(flow.currentA)} A · ${fmt(flow.voltage?.pct, 1)} %`];
  }
}

// ---------------------------------------------------------------- Tablas normativas

export interface NormTableInfo {
  id: string;
  table: string;
  article: string;
  title: string;
  status: VerificationStatus;
  detail: string;
}

/** Tablas de la norma activa con su estado de verificación ([] si no hay datos cargados). */
export function normTables(norm: { id: string; edition: string }): NormTableInfo[] {
  let ds;
  try {
    ds = getNormDataset(norm.id, norm.edition);
  } catch {
    return [];
  }
  return ds.ids().map((id) => {
    const t = ds.table(id);
    const st = ds.status(id);
    return { id, table: t.reference.table, article: t.reference.article, title: t.reference.title, status: st.status, detail: st.detail };
  });
}

/**
 * El reporte es borrador si hay tablas pendientes de verificar o errores en el proyecto.
 * Las tablas de fuente secundaria no lo hacen borrador, pero su estado se declara en el reporte.
 */
export function isDraft(input: ReportInput): boolean {
  return input.issues.some((i) => i.severity === "error") || normTables(input.norm).some((t) => t.status === "por_verificar");
}
