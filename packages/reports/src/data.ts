import { voltageText, type ElementRegistry, type Project } from "@rea/core";
import { buildIslands, sizeShort, wiringText, type ElementFlow, type Island, type PanelSchedule, type SizingRunResult, type Trace } from "@rea/engine";
import { getNormDataset, type VerificationStatus } from "@rea/norm-data";
import { getReportLanguage, rs, type ReportStringKey } from "./strings";
import { DEFAULT_UNITS, sizeText, type DisplayUnits } from "./units";

export * from "./units";

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
  norm: { id: string; edition: string; label: string; methodNote?: string };
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
  return d.toLocaleDateString(getReportLanguage() === "en" ? "en-US" : "es-MX", { year: "numeric", month: "long", day: "numeric" });
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

/** Calibre por fase con su equivalente según las unidades del proyecto, p. ej. "2 × 250 kcmil (127 mm²) Cu". */
export function conductorLabel(c: { designation: string; system: string; conductorsPerPhase: number; material?: string; areaMm2?: number }, u: DisplayUnits = DEFAULT_UNITS): string {
  if (c.designation === "—") return "—";
  return `${c.conductorsPerPhase > 1 ? `${c.conductorsPerPhase} × ` : ""}${sizeText(c.designation, c.system, c.areaMm2, u)}${c.material ? ` ${c.material}` : ""}`;
}

/** Conductor de puesta a tierra / protección con su equivalente. */
export function egcLabel(g: { designation: string; system: string; areaMm2: number }, u: DisplayUnits = DEFAULT_UNITS): string {
  return sizeText(g.designation, g.system, g.areaMm2, u);
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
        conductor: wiringText(c),
        egc: c.conductor.egc ? egcLabel(c.conductor.egc, p.settings.units) : undefined,
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
  const units = sizing.sizedProject.settings.units;
  const flow: ElementFlow | undefined = sizing.loadFlow.elements.get(elementId);
  const circuit = sizing.circuits.get(elementId);
  const asBreaker = [...sizing.circuits.values()].find((c) => c.breakerId === elementId);
  if (!flow && !circuit && !asBreaker) return null;

  const facts: [string, string][] = [];
  if (flow?.currentA !== undefined) facts.push([rs("current"), `${fmt(flow.currentA, 2)} A`]);
  if (flow?.currentSecondaryA !== undefined) facts.push([rs("currentSecondary"), `${fmt(flow.currentSecondaryA, 2)} A`]);
  if (flow?.power) facts.push([rs("power"), `${fmt(flow.power.pKW, 3)} kW · ${fmt(flow.power.qKvar, 3)} kvar · ${fmt(flow.power.sKVA, 3)} kVA · FP ${fmt(flow.power.pf, 3)}`]);
  if (flow?.voltage) {
    const sys = el.params.system;
    const pair = registry.tryGet(el.type)?.electricalRole === "bus" && (sys === "3F4H" || sys === "1F3H") ? ` — ${voltageText(flow.voltage.v, sys, 1)}` : "";
    facts.push([rs("voltage"), `${fmt(flow.voltage.v, 1)} V (${fmt(flow.voltage.pct, 2)} % de ${fmt(flow.voltage.vNom, 1)} V ${flow.voltage.basis})${pair}`]);
  }
  if (flow?.dropPct !== undefined) facts.push([rs("drop"), `${fmt(flow.dropPct, 3)} %`]);
  if (flow?.cumulativeDropPct !== undefined) facts.push([rs("cumulative"), `${fmt(flow.cumulativeDropPct, 3)} %`]);
  if (circuit) {
    const c = circuit.conductor;
    facts.push([rs("designCurrent"), `${fmt(circuit.protection.designA, 2)} A (${circuit.protection.rule})`]);
    facts.push([rs("conductor"), `${conductorLabel(c, units)} — ${fmt(c.ampacityA, 1)} A (${rs("governing").toLowerCase()}: ${rs(`governing.${c.governing}` as ReportStringKey)})`]);
    if (c.designation !== "—") facts.push([rs("wiring"), `${wiringText(circuit)} (${circuit.wiring.reason}; neutro del calibre de fase)`]);
    if (c.egc) facts.push([rs("egc"), `${egcLabel(c.egc, units)}${c.egc.perRaceway ? " en cada canalización" : ""}`]);
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
      // La configuración del cable ya trae el calibre: 3x#2AWG(Ph)+1x#10AWG(Gnd), 2[...] en paralelo.
      // Un renglón por grupo de conductores para que no invada los circuitos vecinos.
      const config = circuit && circuit.conductor.designation !== "—" ? wiringText(circuit).split(/(?=\+)/) : ["sin calibre"];
      return [...config, `${fmt(flow.currentA)} A · ΔV ${fmt(flow.dropPct, 2)} %`];
    }
    case "cable-mt": {
      if (!flow) return [];
      const el = sizing.sizedProject.elements.find((e) => e.id === elementId);
      const size = typeof el?.params.forcedSize === "string" ? ` · ${sizeShort(el.params.forcedSize, Number.isNaN(Number(el.params.forcedSize)) || el.params.forcedSize.includes("/") ? "AWG" : sizing.sizedProject.settings.norm.id === "iec-60364" ? "mm2" : Number(el.params.forcedSize) >= 250 ? "kcmil" : "AWG")}` : "";
      return [`MT ${String(el?.params.insulationKV ?? "")} kV${size}`, `${fmt(flow.currentA)} A`];
    }
    case "breaker": {
      // Polos · marco/ajuste · capacidad interruptiva, p. ej. «3P», «100/100A», «18 kA».
      const el = sizing.sizedProject.elements.find((e) => e.id === elementId);
      const r = [...sizing.circuits.values()].find((c) => c.breakerId === elementId)?.protection.ratingA ?? num(el?.params.forcedRatingA);
      if (!el) return r !== undefined ? [`${r} A`] : [];
      const fuse = String(el.params.deviceType ?? "").startsWith("fusible");
      const frame = num(el.params.frameA) ?? r;
      const ka = num(el.params.interruptingKA);
      return [
        `${String(el.params.poles ?? "3")}P`,
        ...(r === undefined ? [] : [fuse ? `${r} A` : `${frame}/${r}A`]),
        ...(ka !== undefined ? [`${fmt(ka, ka % 1 ? 1 : 0)} kA`] : []),
      ];
    }
    case "transformer":
      return flow ? [`${fmt(flow.power?.sKVA)} kVA`, `ΔV ${fmt(flow.dropPct, 2)} %`] : [];
    case "panelboard":
    case "mcc":
    case "busbar":
    {
      // Con neutro: línea a línea / fase a neutro, p. ej. «216.2/124.8 V (98.29 %)».
      if (!flow?.voltage) return [];
      const system = sizing.sizedProject.elements.find((e) => e.id === elementId)?.params.system;
      return [`${voltageText(flow.voltage.v, system, 1)} (${fmt(flow.voltage.pct, 2)} %)`];
    }
    case "utility":
    case "generator":
      return flow ? [`${fmt(flow.power?.sKVA)} kVA · ${fmt(flow.currentA)} A`] : [];
    default: {
      if (!flow) return [];
      const el = sizing.sizedProject.elements.find((e) => e.id === elementId);
      const load = el && loadPlate(el.type, el.params);
      if (!load) return [`${fmt(flow.currentA)} A · ${fmt(flow.voltage?.pct, 1)} %`];
      // Capacidad · fases - tensión nominal · corriente (FLA en motores), como en los diagramas unifilares de proyecto.
      const fla = el.type === "motor" && flow.ratedCurrentA !== undefined;
      return [load.capacity, load.phasesVoltage, fla ? `${fmt(flow.ratedCurrentA, 2)} A (FLA)` : `${fmt(flow.currentA, 2)} A`];
    }
  }
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const trim = (v: number, d = 2) => String(Number(v.toFixed(d)));

/**
 * Datos de placa de una carga para el diagrama: capacidad en su unidad (HP o kW en motores, W en
 * contactos y alumbrado, kW o kVA en cargas genéricas) y «fases - tensión», p. ej. «3Ph - 460 V».
 */
export function loadPlate(type: string, p: Record<string, unknown>): { capacity: string; phasesVoltage: string } | undefined {
  const sys = String(p.system ?? "");
  const phases = sys.startsWith("3F") ? "3Ph" : sys.startsWith("1F") ? "1Ph" : "";
  const v = num(p.voltageV);
  const phasesVoltage = [phases, v !== undefined ? `${trim(v, 1)} V` : ""].filter(Boolean).join(" - ");
  const qty = num(p.quantity) ?? 1;
  let capacity: string | undefined;
  if (type === "motor") {
    const pw = num(p.ratedPower);
    if (pw !== undefined) capacity = `${trim(pw)} ${p.ratedPowerUnit === "kW" ? "kW" : "HP"}`;
  } else if (type === "luminaire") {
    const w = num(p.wattsPerUnit);
    if (w !== undefined) capacity = `${trim(qty * w, 0)} W`;
  } else if (type === "receptacle") {
    const va = num(p.vaPerOutlet);
    const pf = num(p.powerFactor);
    if (va !== undefined) capacity = pf !== undefined ? `${trim(qty * va * pf, 0)} W` : `${trim(qty * va, 0)} VA`;
  } else if (type === "generic-load" || type === "grouped-load") {
    const pw = num(p.power);
    if (pw !== undefined) capacity = `${trim(pw)} ${p.powerUnit === "kVA" ? "kVA" : "kW"}`;
  }
  return capacity === undefined ? undefined : { capacity, phasesVoltage };
}

// ---------------------------------------------------------------- Tablas normativas

export interface NormTableInfo {
  id: string;
  table: string;
  article: string;
  title: string;
  status: VerificationStatus;
  detail: string;
  /** Páginas del documento fuente. */
  pages: number[];
  /** Solo NOM: numeración equivalente en el NEC, como etiqueta informativa (no implica cumplimiento del NEC). */
  necEquivalent?: string;
}

/**
 * La NOM-001-SEDE-2012 sigue la numeración del NEC 2011 con guion en lugar de punto
 * («310-15(b)(16)» ≈ «310.15(B)(16)»), y su Capítulo 10 corresponde al Capítulo 9 del NEC.
 * Es solo una etiqueta de referencia: los valores son los de la NOM.
 */
export function necEquivalent(nomTable: string): string {
  const s = nomTable
    .replace("Capítulo 10", "Capítulo 9")
    .replace(/(\d{3})-(\d+)/, "$1.$2")
    .replace(/\(([a-z])\)/g, (m) => m.toUpperCase());
  return `≈ NEC 2011 ${s}`;
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
    return {
      id,
      table: t.reference.table,
      article: t.reference.article,
      title: t.reference.title,
      status: st.status,
      detail: st.detail,
      pages: t.source.pages,
      necEquivalent: norm.id === "nom-001-sede" ? necEquivalent(t.reference.table) : undefined,
    };
  });
}

/**
 * El reporte es borrador si hay tablas pendientes de verificar o errores en el proyecto.
 * Las tablas de fuente secundaria no lo hacen borrador, pero su estado se declara en el reporte.
 */
export function isDraft(input: ReportInput): boolean {
  return input.issues.some((i) => i.severity === "error") || normTables(input.norm).some((t) => t.status === "por_verificar");
}
