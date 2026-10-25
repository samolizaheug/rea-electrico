import type { ElementRegistry, Project, ProjectElement } from "@rea/core";
import type { ConductorDecision, NormModule, ProtectionDecision, SizingCircuit, SizingLoadItem, Wiring } from "../norm-module";
import { fmtNum } from "../trace";
import { runLoadFlow, type LoadFlowIssue, type LoadFlowResult } from "./loadflow";
import { buildIslands, type Island, type NetEdge } from "./network";

/**
 * Dimensionamiento de conductores, protecciones y conductor de puesta a tierra.
 * El motor arma cada circuito (cable + protección de origen + lo que alimenta) y delega las
 * reglas a la norma activa (NormModule.sizing). Orden:
 * 1. Flujo de carga nominal (las corrientes no dependen de los calibres en este método).
 * 2. Protecciones, de aguas abajo hacia la fuente (430-62 necesita las protecciones de los derivados).
 * 3. Conductores, de la fuente hacia aguas abajo (el límite total de caída depende de lo consumido aguas arriba).
 * 4. Flujo de carga final con los calibres y protecciones elegidos.
 */

export interface CircuitSizing {
  cableId: string;
  tag: string;
  breakerId?: string;
  circuitKind: "alimentador" | "derivado";
  protection: ProtectionDecision;
  conductor: ConductorDecision;
  /** Fases y neutro del circuito (para su configuración de conductores). */
  wiring: Wiring;
}

export interface SizingRunResult {
  calculated: boolean;
  circuits: Map<string, CircuitSizing>;
  /** Proyecto con los calibres y capacidades seleccionados aplicados (no se guarda). */
  sizedProject: Project;
  /** Flujo de carga con los calibres seleccionados. */
  loadFlow: LoadFlowResult;
  issues: LoadFlowIssue[];
}

const n = (v: unknown, fb = NaN) => (typeof v === "number" ? v : fb);

export function runSizing(project: Project, registry: ElementRegistry, norm: NormModule): SizingRunResult {
  const issues: LoadFlowIssue[] = [];
  const circuits = new Map<string, CircuitSizing>();
  const base = runLoadFlow(project, registry, norm, { mode: "nominal" });
  if (!base.calculated || !norm.sizing || !norm.calc) {
    if (!norm.sizing) issues.push({ severity: "error", code: "norma-sin-datos", message: `La norma ${norm.label} no tiene reglas de dimensionamiento.`, elementIds: [] });
    return { calculated: false, circuits, sizedProject: project, loadFlow: base, issues: [...base.issues, ...issues] };
  }
  issues.push(...base.issues.filter((i) => i.severity === "error" && !["caida-tramo", "caida-total", "tension-terminales", "impedancia-conductor"].includes(i.code)));

  const els = new Map(project.elements.map((e) => [e.id, e]));
  const defOf = (id: string) => registry.get(els.get(id)!.type);
  const settings = project.settings;

  for (const island of buildIslands(project, registry)) {
    const cableEdges = island.order.map((id) => island.parentEdge.get(id)).filter((e): e is NetEdge => !!e && defOf(e.elementId).calcBehavior === "branch.cable");

    // ---- Cables de media tensión: no se dimensionan en la fase 1; se verifica su clase de aislamiento.
    for (const id of island.order) {
      const pe = island.parentEdge.get(id);
      if (!pe || defOf(pe.elementId).calcBehavior !== "branch.cable-mv") continue;
      const el = els.get(pe.elementId)!;
      const vLL = island.nodes.get(pe.child)!.vNomLL;
      const kv = Number(el.params.insulationKV);
      if (Number.isFinite(kv) && vLL > kv * 1000 + 1e-6)
        issues.push({ severity: "error", code: "aislamiento-mt", message: `${el.tag}: cable de clase ${kv} kV en un sistema de ${fmtNum(vLL / 1000, 2)} kV; elija una clase de aislamiento igual o mayor.`, elementIds: [el.id] });
      else if (vLL <= 1000)
        issues.push({ severity: "warning", code: "cable-mt-en-bt", message: `${el.tag}: cable de media tensión en un circuito de ${fmtNum(vLL, 0)} V; para baja tensión use «Alimentador (cable)», que sí se dimensiona.`, elementIds: [el.id] });
      else
        issues.push({ severity: "info", code: "cable-mt", message: `${el.tag}: cable de media tensión (${fmtNum(vLL / 1000, 2)} kV, clase ${kv} kV): no se dimensiona ni se incluye su impedancia en la fase 1.`, elementIds: [el.id] });
    }

    // ---- Circuitos.
    const circuitOf = new Map<string, SizingCircuit>();
    for (const e of cableEdges) circuitOf.set(e.elementId, buildCircuit(e, island, project, els, defOf, base, norm));

    // ---- Protecciones (de aguas abajo hacia la fuente).
    const protections = new Map<string, ProtectionDecision>();
    for (const e of [...cableEdges].reverse()) {
      const c = circuitOf.get(e.elementId)!;
      c.downstreamMotorProtection = descendantCables(e.child, island)
        .map((id) => ({ id, c: circuitOf.get(id), p: protections.get(id) }))
        .filter((x) => x.c && x.p?.ratingA !== undefined && x.c.items.length === 1 && x.c.items[0]!.kind === "motor")
        .map((x) => ({ elementId: x.id, tag: x.c!.tag, ratingA: x.p!.ratingA!, flcA: x.c!.items[0]!.motor!.flcA }));
      protections.set(e.elementId, norm.sizing.protection(c));
    }

    // ---- Conductores (de la fuente hacia aguas abajo).
    const cumAt = new Map<string, number>([[island.root, 0]]);
    for (const id of island.order.slice(1)) {
      const e = island.parentEdge.get(id)!;
      const parentCum = cumAt.get(e.parent) ?? 0;
      if (e.role === "transformer" || e.role === "converter") {
        cumAt.set(id, 0);
        continue;
      }
      if (defOf(e.elementId).calcBehavior !== "branch.cable") {
        cumAt.set(id, parentCum);
        continue;
      }
      const c = circuitOf.get(e.elementId)!;
      const p = protections.get(e.elementId)!;
      const flow = base.elements.get(e.elementId);
      const cable = els.get(e.elementId)!;
      const sensitive = c.items.some((i) => i.kind === "carga" && els.get(i.elementId)?.params.sensitiveElectronic === true);
      const vdNorm = norm.voltageDrop;
      const sensitiveCrit = vdNorm?.special.find((s) => s.id === "electronico-sensible");

      const dropFor = (designation: string, npar: number) => {
        const zi = norm.calc!.conductorImpedance({ designation, material: cable.params.material === "Al" ? "Al" : "Cu", installationMethod: String(cable.params.installationMethod ?? ""), frequencyHz: settings.frequencyHz });
        if (!zi.ok) return { error: `${cable.tag}: ${zi.error}` };
        const iA = flow?.currentA ?? 0;
        const pf = flow?.power?.pf ?? 1;
        const sin = Math.sqrt(Math.max(0, 1 - pf * pf)) * Math.sign(flow?.power?.qKvar ?? 1);
        const ze = zi.rOhmPerKm * pf + zi.xOhmPerKm * sin;
        const k = c.m === 1 ? 2 : 1;
        const pct = ((k * iA * ze * (n(cable.params.lengthM) / 1000)) / npar / c.vc) * 100;
        if (c.circuitKind === "alimentador") return { pct, limitPct: settings.voltageDrop.feederPct, limitSource: limitSource(settings.voltageDrop.feederPct, vdNorm?.feeder) };
        const branchLim = sensitive && sensitiveCrit?.branch ? sensitiveCrit.branch : { pct: settings.voltageDrop.branchPct, source: limitSource(settings.voltageDrop.branchPct, vdNorm?.branch) };
        const totalLim = sensitive && sensitiveCrit?.total ? sensitiveCrit.total : { pct: settings.voltageDrop.totalPct, source: limitSource(settings.voltageDrop.totalPct, vdNorm?.total) };
        const remaining = totalLim.pct - parentCum;
        return remaining < branchLim.pct
          ? { pct, limitPct: Math.max(0, Number(remaining.toFixed(4))), limitSource: `total ${totalLim.pct} % (${totalLim.source}) menos ${fmtNum(parentCum, 3)} % ya consumido aguas arriba` }
          : { pct, limitPct: branchLim.pct, limitSource: branchLim.source };
      };
      const cd = norm.sizing.conductor(c, p, dropFor);
      cumAt.set(id, parentCum + (Number.isFinite(cd.dropPct) ? cd.dropPct : 0));
      circuits.set(e.elementId, { cableId: e.elementId, tag: c.tag, breakerId: c.breaker?.elementId, circuitKind: c.circuitKind, protection: p, conductor: cd, wiring: c.wiring });
      for (const i of [...p.issues, ...cd.issues]) issues.push({ severity: i.severity, code: "dimensionamiento", message: i.message, elementIds: [e.elementId, ...(c.breaker ? [c.breaker.elementId] : [])] });
    }
  }

  // ---- Proyecto con la selección aplicada y flujo final.
  const sized: Project = structuredClone(project);
  for (const cs of circuits.values()) {
    const cable = sized.elements.find((x) => x.id === cs.cableId)!;
    if (cs.conductor.designation !== "—") cable.params.forcedSize = cs.conductor.designation;
    if (cs.breakerId && cs.protection.ratingA !== undefined) {
      const br = sized.elements.find((x) => x.id === cs.breakerId)!;
      if (typeof br.params.forcedRatingA !== "number") br.params.forcedRatingA = cs.protection.ratingA;
    }
  }
  const loadFlow = runLoadFlow(sized, registry, norm, { mode: "nominal" });
  issues.push(...loadFlow.issues.filter((i) => ["caida-total", "tension-terminales", "bomba-contra-incendio", "dato-aproximado"].includes(i.code)));
  return { calculated: true, circuits, sizedProject: sized, loadFlow, issues };
}

function limitSource(value: number, crit?: { pct: number; source: string }): string {
  return crit && crit.pct === value ? crit.source : "criterio del proyecto";
}

/** Cables que cuelgan (directa o indirectamente) de un nodo, sin cruzar transformadores ni convertidores. */
function descendantCables(nodeId: string, island: Island): string[] {
  const out: string[] = [];
  for (const e of island.children.get(nodeId) ?? []) {
    if (e.role === "transformer" || e.role === "converter") continue;
    if (e.role === "branch") out.push(e.elementId);
    out.push(...descendantCables(e.child, island));
  }
  return out;
}

function buildCircuit(
  e: NetEdge,
  island: Island,
  project: Project,
  els: Map<string, ProjectElement>,
  defOf: (id: string) => ReturnType<ElementRegistry["get"]>,
  base: LoadFlowResult,
  norm: NormModule,
): SizingCircuit {
  const cable = els.get(e.elementId)!;
  const parentNode = island.nodes.get(e.parent)!;
  const child = island.nodes.get(e.child)!;
  const flow = base.elements.get(e.elementId);

  // Protección de origen: el interruptor que alimenta el nodo de origen del cable.
  const upstream = island.parentEdge.get(e.parent);
  const breakerEl = upstream && defOf(upstream.elementId).calcBehavior === "switch.protective" ? els.get(upstream.elementId) : undefined;
  const originNode = breakerEl ? island.nodes.get(upstream!.parent)! : parentNode;
  const assembly100 = originNode.buses.some((b) => els.get(b)!.params.ratedFor100Pct === true);
  const transformerSecondary = !breakerEl && upstream?.role === "transformer";

  // Cargas y equipos alimentados; de paso se ve si el circuito necesita neutro.
  const items: SizingLoadItem[] = [];
  const amps = (sVA: number) => sVA / (child.m * child.vcNom);
  const neutralBy: string[] = [];
  const walk = (nodeId: string) => {
    const node = island.nodes.get(nodeId)!;
    for (const b of node.buses) {
      const sys = els.get(b)!.params.system;
      if (sys === "3F4H" || sys === "1F3H") neutralBy.push(`${els.get(b)!.tag} (${sys})`);
    }
    if (node.circuit?.connection === "LN") neutralBy.push("cargas fase-neutro");
    for (const lid of node.loads) {
      const el = els.get(lid)!;
      const def = defOf(lid);
      if (el.params.system === "3F4H" || el.params.system === "1F3H") neutralBy.push(`${el.tag} (${String(el.params.system)})`);
      const lf = base.elements.get(lid);
      const sVA = (lf?.power?.sKVA ?? 0) * 1000;
      if (def.calcBehavior === "load.motor") {
        const flc = lf?.ratedCurrentA ?? amps(sVA);
        items.push({
          elementId: lid,
          tag: el.tag,
          kind: "motor",
          amps: flc,
          motor: {
            flcA: flc,
            flcSource: el.params.currentSource === "placa" ? "corriente de placa" : "corriente de tabla",
            motorType: String(el.params.motorType ?? "jaula"),
            dutyClass: String(el.params.dutyClass ?? "continuo"),
            dutyRating: String(el.params.dutyRating ?? "continuo"),
            designLetter: String(el.params.designLetter ?? "desconocida"),
            nameplateA: typeof el.params.nameplateCurrentA === "number" ? el.params.nameplateCurrentA : null,
          },
        });
      } else {
        const cp = el.params.continuous;
        const auto = cp !== "si" && cp !== "no";
        const continuous = auto ? def.calcBehavior === "load.lighting" : cp === "si";
        items.push({
          elementId: lid,
          tag: el.tag,
          kind: "carga",
          amps: amps(sVA),
          continuous,
          continuousSource: auto ? (continuous ? "alumbrado: continua por defecto" : "no continua por defecto") : "capturado por el usuario",
          receptacleOutlets: def.calcBehavior === "load.receptacle" ? n(el.params.quantity, 1) : undefined,
          nonLinear: el.params.nonLinear === true,
        });
      }
    }
    for (const ce of island.children.get(nodeId) ?? []) {
      const ceEl = els.get(ce.elementId)!;
      if (ce.role === "transformer") {
        const sn = n(ceEl.params.ratedKVA) * 1000;
        const vp = n(ce.reverse ? ceEl.params.secondaryVoltageV : ceEl.params.primaryVoltageV);
        const ip = child.m === 3 ? sn / (Math.sqrt(3) * vp) : sn / vp;
        items.push({ elementId: ce.elementId, tag: ceEl.tag, kind: "transformador", amps: ip, transformer: { ratedPrimaryA: ip, sn, primaryV: vp } });
      } else if (ce.role === "converter") {
        const cf = base.elements.get(ce.elementId);
        const rated = n(ceEl.params.ratedInputCurrentA);
        const inputA = Number.isFinite(rated) ? rated : cf?.currentA ?? 0;
        const src = Number.isFinite(rated) ? "corriente nominal de entrada (placa)" : "corriente de entrada calculada con la carga (no se capturó la de placa)";
        if (defOf(ce.elementId).calcBehavior === "converter.vfd") items.push({ elementId: ce.elementId, tag: ceEl.tag, kind: "variador", amps: inputA, vfd: { inputA, inputSource: src } });
        else items.push({ elementId: ce.elementId, tag: ceEl.tag, kind: "carga", amps: inputA, continuous: true, continuousSource: "UPS: continua por defecto" });
      } else {
        walk(ce.child);
      }
    }
  };
  walk(e.child);

  // Fases y neutro: circuito monofásico respecto a la zona (fase-neutro o entre fases) o zona
  // monofásica/trifásica; el neutro va si lo que se alimenta trabaja a 4 hilos o fase-neutro.
  const phases: Wiring["phases"] = child.circuit ? (child.circuit.connection === "LN" ? 1 : 2) : child.system === "1F3H" ? 2 : child.system === "1F2H" ? 1 : 3;
  const forcedNeutral = child.circuit?.connection === "LN" || child.system === "1F2H";
  const neutral = forcedNeutral || (child.system !== "3F3H" && neutralBy.length > 0);
  const wiring: Wiring = {
    phases,
    neutral,
    reason: forcedNeutral ? "circuito fase-neutro" : neutral ? `alimenta a ${[...new Set(neutralBy)].slice(0, 3).join(", ")}` : "lo que alimenta no usa neutro",
  };

  const params = cable.params;
  const method = String(params.installationMethod ?? "");
  const buried = norm.isBuried ? norm.isBuried(method) : method.startsWith("enterrado");
  const ambientParam = n(params.ambientTempC);
  return {
    cableId: cable.id,
    tag: cable.tag,
    params,
    circuitKind: flow?.circuitKind ?? "derivado",
    m: child.m,
    system: child.system,
    vNomLL: child.vNomLL,
    vc: child.vcNom,
    items,
    breaker: breakerEl ? { elementId: breakerEl.id, tag: breakerEl.tag, params: breakerEl.params } : undefined,
    assembly100,
    ambientC: Number.isFinite(ambientParam) ? ambientParam : buried ? project.settings.ambient.groundC : project.settings.ambient.airC,
    ambientSource: Number.isFinite(ambientParam) ? "capturada en el alimentador" : buried ? "temperatura del terreno del proyecto" : "temperatura ambiente del proyecto",
    transformerSecondary,
    downstreamMotorProtection: [],
    wiring,
  };
}

/** Designación compacta de un calibre: «#2AWG», «#1/0AWG», «250kcmil», «25mm²». */
export function sizeShort(designation: string, system: string): string {
  return system === "AWG" ? `#${designation}AWG` : system === "kcmil" ? `${designation}kcmil` : system === "mm2" ? `${designation}mm²` : designation;
}

/**
 * Configuración de los conductores de un circuito, p. ej.
 * «3x#2AWG(Ph)+1x#10AWG(Gnd)», «3x#2AWG(Ph)+1x#2AWG(N)+1x#10AWG(Gnd)» o, con 2 conductores por fase,
 * «2[3x#2AWG(Ph)+1x#10AWG(Gnd)]». El neutro se indica del mismo calibre que la fase.
 * En IEC (calibres en mm²) el conductor de protección se rotula PE.
 */
export function wiringText(c: Pick<CircuitSizing, "conductor" | "wiring">): string {
  const d = c.conductor;
  if (d.designation === "—") return "—";
  const ph = sizeShort(d.designation, d.system);
  let core = `${c.wiring.phases}x${ph}(Ph)`;
  if (c.wiring.neutral) core += `+1x${ph}(N)`;
  if (d.egc) core += `+1x${sizeShort(d.egc.designation, d.egc.system)}(${d.system === "mm2" ? "PE" : "Gnd"})`;
  return d.conductorsPerPhase > 1 ? `${d.conductorsPerPhase}[${core}]` : core;
}
