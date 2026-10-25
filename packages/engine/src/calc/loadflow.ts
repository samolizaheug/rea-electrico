import type { ElementRegistry, Project, ProjectElement } from "@rea/core";
import { DEFAULT_EQUIPMENT_VOLTAGE, type Criterion, type NormModule } from "../norm-module";
import { validateTopology } from "../topology/validate";
import { fmtNum, type Trace, type TraceStep } from "../trace";
import { Complex } from "./complex";
import { loadDemand } from "./loads";
import { buildIslands, type Island, type NetEdge, type NetNode } from "./network";

/**
 * Flujo de carga radial (fase 1).
 *
 * Modos:
 * - "nominal": método de cálculo a mano. Las cargas se evalúan a tensión nominal, las corrientes
 *   se obtienen de la suma de potencias aguas abajo (sin pérdidas), la caída en conductores con
 *   la impedancia eficaz de la Tabla 9 (Ze = R·cosφ + X·senφ) y la regulación del transformador
 *   con %ΔV ≈ (S/Sn)·(%R·cosφ + %X·senφ). Es verificable a mano y es el que muestra la memoria.
 * - "barrido": barrido iterativo hacia atrás y hacia adelante con fasores y cargas de potencia
 *   constante, incluyendo pérdidas. Es el cálculo de referencia; preparado para sustituirse por
 *   Newton-Raphson en redes malladas (fase posterior).
 *
 * Supuestos (aparecen en la memoria):
 * - Red equilibrada (secuencia positiva). Las cargas monofásicas se suman a la red trifásica y
 *   su circuito derivado se evalúa como circuito de dos conductores (k = 2).
 * - Corriente de motores: la de tabla (o placa) se toma a la tensión nominal del sistema.
 * - Interruptores y ATS sin impedancia; variadores y UPS regulan su tensión de salida.
 * - Se desprecia el desfasamiento angular de los transformadores (no afecta magnitudes).
 */

export type LoadFlowMode = "nominal" | "barrido";

export interface ElementFlow {
  elementId: string;
  /** Corriente del elemento (A). En ramas, del lado de la fuente; en transformadores, la del primario. */
  currentA?: number;
  /** Solo transformadores: corriente del secundario (A). */
  currentSecondaryA?: number;
  /** Potencia que entra al elemento desde la fuente (cargas: la que consumen). */
  power?: { pKW: number; qKvar: number; sKVA: number; pf: number };
  /** Caída de tensión en el elemento (% de la tensión nominal del circuito) y en volts. */
  dropPct?: number;
  dropV?: number;
  /** Tensión en el extremo de carga del elemento (o en su nodo para cargas y barras). */
  voltage?: { v: number; vNom: number; pct: number; basis: "entre fases" | "fase-neutro" | "del circuito" };
  /** Caída acumulada en conductores desde el origen de la zona de tensión (secundario o fuente). */
  cumulativeDropPct?: number;
  circuitKind?: "alimentador" | "derivado";
  /** Motores: corriente de tabla o placa. */
  ratedCurrentA?: number;
  traces: Trace[];
}

export interface LoadFlowIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  elementIds: string[];
}

export interface LoadFlowResult {
  mode: LoadFlowMode;
  /** false si la topología tiene errores que impiden calcular. */
  calculated: boolean;
  converged: boolean;
  iterations: number;
  elements: Map<string, ElementFlow>;
  issues: LoadFlowIssue[];
}

export interface LoadFlowOptions {
  mode?: LoadFlowMode;
  maxIterations?: number;
  /** Tolerancia de convergencia relativa a la tensión nominal. */
  tolerance?: number;
}

const BLOCKING = new Set(["tipo-desconocido", "lazo", "fuentes-en-paralelo", "tension-incompatible", "sistema-incompatible"]);
const n = (v: unknown, fallback = NaN) => (typeof v === "number" ? v : fallback);

interface EdgeData {
  edge: NetEdge;
  el: ProjectElement;
  /** Impedancia serie (Ω) referida al lado de la carga; para cables, total del tramo y conductores en paralelo. */
  z: Complex;
  /** Factor de recorrido de la corriente: 2 en circuitos monofásicos de dos conductores. */
  k: number;
  /** Relación de transformación aplicada a Vc (transformadores). */
  ratio: number;
  /** Datos del transformador para el método aproximado. */
  tr?: { sn: number; rPct: number; xPct: number };
  /** Variadores/UPS. */
  conv?: { eta: number; pfIn: number };
  /** Escala de la tensión de envío (circuito monofásico derivado de un nodo trifásico). */
  vScale: number;
  traces: Trace[];
  circuitKind?: "alimentador" | "derivado";
  hasImpedance: boolean;
}

export function runLoadFlow(project: Project, registry: ElementRegistry, norm: NormModule, opts: LoadFlowOptions = {}): LoadFlowResult {
  // El método nominal es el resultado principal de la memoria (decisión del usuario, 2026-10-24); el barrido es la referencia.
  const mode = opts.mode ?? "nominal";
  const issues: LoadFlowIssue[] = [];
  const elements = new Map<string, ElementFlow>();
  const result: LoadFlowResult = { mode, calculated: false, converged: false, iterations: 0, elements, issues };

  const topo = validateTopology(project, registry);
  const blocking = topo.issues.filter((i) => i.severity === "error" && BLOCKING.has(i.code));
  if (blocking.length) {
    issues.push(...blocking.map((i) => ({ severity: "error" as const, code: i.code, message: `No se puede calcular: ${i.message}`, elementIds: i.elementIds })));
    return result;
  }
  if (!norm.calc) {
    issues.push({ severity: "error", code: "norma-sin-datos", message: `La norma ${norm.label} no tiene datos para calcular.`, elementIds: [] });
    return result;
  }

  const els = new Map(project.elements.map((e) => [e.id, e]));
  let converged = true;
  let iterations = 0;
  for (const island of buildIslands(project, registry)) {
    const r = solveIsland(island, project, registry, norm, mode, opts, elements, issues);
    converged &&= r.converged;
    iterations = Math.max(iterations, r.iterations);
  }
  result.calculated = true;
  result.converged = converged;
  result.iterations = iterations;
  checkCriteria(project, registry, norm, els, elements, issues);
  return result;
}

// ---------------------------------------------------------------- Solución de una isla

function solveIsland(
  island: Island,
  project: Project,
  registry: ElementRegistry,
  norm: NormModule,
  mode: LoadFlowMode,
  opts: LoadFlowOptions,
  out: Map<string, ElementFlow>,
  issues: LoadFlowIssue[],
): { converged: boolean; iterations: number } {
  const els = new Map(project.elements.map((e) => [e.id, e]));
  const { nodes, order } = island;
  const src = els.get(island.sourceId)!;
  const rootNode = nodes.get(island.root)!;

  // ---- Demandas de carga.
  const loadS = new Map<string, Complex>();
  const loadTrace = new Map<string, { trace: Trace; ratedCurrentA?: number }>();
  for (const id of order) {
    const node = nodes.get(id)!;
    for (const lid of node.loads) {
      const el = els.get(lid)!;
      const d = loadDemand(el, registry.get(el.type), norm, node.vNomLL, node.vcNom);
      if (d.error) issues.push({ severity: "error", code: "dato-carga", message: d.error, elementIds: [lid] });
      for (const w of d.warnings ?? []) issues.push({ severity: "warning", code: "dato-aproximado", message: w, elementIds: [lid] });
      loadS.set(lid, d.s);
      loadTrace.set(lid, { trace: d.trace, ratedCurrentA: d.ratedCurrentA });
    }
  }

  // ---- Datos de las ramas.
  const edges = new Map<string, EdgeData>(); // por nodo hijo
  for (const id of order) {
    const e = island.parentEdge.get(id);
    if (e) edges.set(id, edgeData(e, els.get(e.elementId)!, nodes.get(e.parent)!, nodes.get(id)!, island, nodes, norm, issues, project.settings.frequencyHz));
  }

  // ---- Impedancia de la fuente (si se capturó la potencia de cortocircuito de la red).
  const pu = n(src.params.operatingVoltagePu, 1);
  const scc = n(src.params.shortCircuitMVA);
  const sxr = n(src.params.xrRatio);
  let zSrc = Complex.ZERO;
  const srcSteps: TraceStep[] = [{ label: "Tensión de la fuente", formula: "V = V_nom · pu", substitution: `V = ${fmtNum(rootNode.vNomLL, 0)} · ${pu}`, result: `${fmtNum(rootNode.vNomLL * pu, 1)} V entre fases` }];
  if (scc > 0 && sxr > 0) {
    const zmag = (rootNode.vNomLL * rootNode.vNomLL) / (scc * 1e6);
    const r = zmag / Math.sqrt(1 + sxr * sxr);
    zSrc = new Complex(r, r * sxr);
    srcSteps.push({ label: "Impedancia equivalente de la red", formula: "|Z| = V² / Scc ;  R = |Z| / √(1 + (X/R)²) ;  X = R · X/R", substitution: `|Z| = ${fmtNum(rootNode.vNomLL, 0)}² / ${fmtNum(scc * 1e6, 0)}`, result: `R = ${fmtNum(zSrc.re, 5)} Ω ;  X = ${fmtNum(zSrc.im, 5)} Ω` });
  } else {
    srcSteps.push({ label: "Impedancia de la red", result: "No capturada: la fuente se considera ideal (tensión constante en su punto de conexión)." });
  }

  // ---- Solución.
  const sNode = new Map<string, Complex>(); // potencia total que demanda el nodo (cargas + ramas hijas)
  const sIn = new Map<string, Complex>(); // potencia que entra a la rama que alimenta al nodo (lado fuente)
  const iChild = new Map<string, Complex>(); // corriente de la rama del lado del nodo hijo (Vc)
  const vc = new Map<string, Complex>(); // tensión del circuito en cada nodo
  const vPct = new Map<string, number>(); // método nominal: tensión en % de la nominal
  const dropPctEdge = new Map<string, number>(); // por nodo hijo
  let iterations = 0;
  let converged = true;

  const backward = (withLosses: boolean) => {
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i]!;
      const node = nodes.get(id)!;
      let s = Complex.ZERO;
      for (const l of node.loads) s = s.add(loadS.get(l)!);
      for (const ce of island.children.get(id) ?? []) s = s.add(sIn.get(ce.child)!);
      sNode.set(id, s);
      const ed = edges.get(id);
      if (!ed) continue;
      const v = vc.get(id) ?? new Complex(node.vcNom);
      const i_ = s.div(v.mul(node.m)).conj();
      iChild.set(id, i_);
      if (ed.conv) {
        const pIn = s.re / ed.conv.eta;
        sIn.set(id, new Complex(pIn, pIn * Math.tan(Math.acos(ed.conv.pfIn))));
      } else if (withLosses) {
        const loss = ed.z.mul(i_.abs() ** 2 * node.m * ed.k);
        sIn.set(id, s.add(loss));
      } else {
        sIn.set(id, s);
      }
    }
  };

  if (mode === "nominal") {
    for (const id of order) vc.set(id, new Complex(nodes.get(id)!.vcNom));
    backward(false);
    // Hacia adelante con caídas porcentuales (método aproximado).
    const sRoot = sNode.get(island.root)!;
    let dropSrc = 0;
    if (zSrc.abs() > 0 && sRoot.abs() > 0) {
      const iR = sRoot.abs() / (rootNode.m * rootNode.vcNom);
      dropSrc = ((iR * (zSrc.re * (sRoot.re / sRoot.abs()) + zSrc.im * (sRoot.im / sRoot.abs()))) / rootNode.vcNom) * 100;
    }
    vPct.set(island.root, pu * 100 - dropSrc);
    for (const id of order.slice(1)) {
      const ed = edges.get(id)!;
      const node = nodes.get(id)!;
      const s = sNode.get(id)!;
      const sm = s.abs();
      const cos = sm > 0 ? s.re / sm : 1;
      const sin = sm > 0 ? s.im / sm : 0;
      let d = 0;
      if (ed.tr) d = (sm / ed.tr.sn) * (ed.tr.rPct * cos + ed.tr.xPct * sin);
      else if (ed.hasImpedance) d = ((ed.k * (sm / (node.m * node.vcNom)) * (ed.z.re * cos + ed.z.im * sin)) / node.vcNom) * 100;
      dropPctEdge.set(id, d);
      const parentPct = vPct.get(ed.edge.parent)!;
      vPct.set(id, ed.conv ? 100 : ed.tr ? parentPct / (1 + n(ed.el.params.tapPct, 0) / 100) - d : parentPct - d);
    }
  } else {
    // Barrido iterativo con fasores.
    for (const id of order) vc.set(id, new Complex(nodes.get(id)!.vcNom));
    const maxIt = opts.maxIterations ?? 100;
    const tol = opts.tolerance ?? 1e-9;
    converged = false;
    for (iterations = 1; iterations <= maxIt; iterations++) {
      backward(true);
      let maxDelta = 0;
      // Raíz: fuente con su impedancia.
      const sRoot = sNode.get(island.root)!;
      const vRootOld = vc.get(island.root)!;
      const iRoot = sRoot.div(vRootOld.mul(rootNode.m)).conj();
      const vRoot = new Complex(rootNode.vcNom * pu).sub(iRoot.mul(zSrc));
      maxDelta = Math.max(maxDelta, vRoot.sub(vRootOld).abs() / rootNode.vcNom);
      vc.set(island.root, vRoot);
      for (const id of order.slice(1)) {
        const ed = edges.get(id)!;
        const node = nodes.get(id)!;
        const vp = vc.get(ed.edge.parent)!;
        let vNew: Complex;
        if (ed.conv) vNew = new Complex(node.vcNom);
        else if (ed.tr) vNew = vp.mul(ed.ratio).sub(iChild.get(id)!.mul(ed.z));
        else {
          const vSend = ed.vScale === 1 ? vp : new Complex(vp.abs() * ed.vScale);
          vNew = vSend.sub(iChild.get(id)!.mul(ed.z).mul(ed.k));
        }
        maxDelta = Math.max(maxDelta, vNew.sub(vc.get(id)!).abs() / node.vcNom);
        vc.set(id, vNew);
      }
      if (maxDelta < tol) {
        converged = true;
        break;
      }
    }
    if (!converged) issues.push({ severity: "error", code: "no-converge", message: `El barrido no convergió en ${maxIt} iteraciones (fuente ${src.tag}).`, elementIds: [src.id] });
    backward(true);
    for (const id of order) vPct.set(id, (vc.get(id)!.abs() / nodes.get(id)!.vcNom) * 100);
    for (const id of order.slice(1)) {
      const ed = edges.get(id)!;
      if (ed.conv) continue;
      const parentV = vc.get(ed.edge.parent)!;
      const node = nodes.get(id)!;
      const vSend = ed.tr ? parentV.abs() * ed.ratio : ed.vScale === 1 ? parentV.abs() : parentV.abs() * ed.vScale;
      dropPctEdge.set(id, ((vSend - vc.get(id)!.abs()) / node.vcNom) * 100);
    }
  }

  // ---- Resultados.
  const cum = new Map<string, number>([[island.root, 0]]);
  for (const id of order.slice(1)) {
    const ed = edges.get(id)!;
    cum.set(id, ed.tr || ed.conv ? 0 : cum.get(ed.edge.parent)! + (ed.edge.role === "branch" ? dropPctEdge.get(id) ?? 0 : 0));
  }

  const powerOf = (s: Complex) => ({ pKW: s.re / 1000, qKvar: s.im / 1000, sKVA: s.abs() / 1000, pf: s.abs() > 0 ? s.re / s.abs() : 1 });
  const voltageOf = (node: NetNode) => {
    const pct = vPct.get(node.id)!;
    const basis: "entre fases" | "del circuito" = node.m === 3 ? "entre fases" : "del circuito";
    const vNom = node.m === 3 ? node.vNomLL : node.vcNom;
    return { v: (vNom * pct) / 100, vNom, pct, basis };
  };
  const modeLabel = mode === "nominal" ? "Método nominal (cálculo a mano)" : "Barrido iterativo (fasores)";

  // Fuente.
  const sRoot = sNode.get(island.root)!;
  const iSrc = sRoot.abs() / (rootNode.m * rootNode.vcNom);
  srcSteps.push({ label: "Potencia total suministrada", result: `P = ${fmtNum(sRoot.re / 1000, 3)} kW ;  Q = ${fmtNum(sRoot.im / 1000, 3)} kvar ;  S = ${fmtNum(sRoot.abs() / 1000, 3)} kVA` });
  srcSteps.push({ label: "Corriente suministrada", formula: "I = S / (√3 · V)", substitution: `I = ${fmtNum(sRoot.abs(), 0)} / (√3 · ${fmtNum(rootNode.vNomLL, 0)})`, result: `${fmtNum(iSrc, 2)} A` });
  out.set(src.id, { elementId: src.id, currentA: iSrc, power: powerOf(sRoot), voltage: voltageOf(rootNode), cumulativeDropPct: 0, traces: [{ title: `${src.tag}: fuente (${modeLabel})`, steps: srcSteps }] });

  for (const id of order) {
    const node = nodes.get(id)!;
    const v = voltageOf(node);
    for (const b of node.buses) {
      out.set(b, { elementId: b, power: powerOf(sNode.get(id)!), voltage: v, cumulativeDropPct: cum.get(id), traces: [{ title: `${els.get(b)!.tag}: tensión en barras`, steps: [{ label: modeLabel, result: `${fmtNum(v.v, 1)} V (${fmtNum(v.pct, 2)} % de ${fmtNum(v.vNom, 0)} V)` }] }] });
    }
    for (const l of node.loads) {
      const s = loadS.get(l)!;
      const lt = loadTrace.get(l)!;
      const iL = mode === "nominal" ? s.abs() / (node.m * node.vcNom) : s.div(vc.get(id)!.mul(node.m)).conj().abs();
      const steps: TraceStep[] = [
        {
          label: "Corriente de la carga",
          formula: node.m === 3 ? "I = S / (√3 · V)" : "I = S / V",
          substitution: node.m === 3 ? `I = ${fmtNum(s.abs(), 1)} / (√3 · ${fmtNum(mode === "nominal" ? node.vNomLL : (node.vNomLL * vPct.get(id)!) / 100, 1)})` : `I = ${fmtNum(s.abs(), 1)} / ${fmtNum(mode === "nominal" ? node.vcNom : vc.get(id)!.abs(), 1)}`,
          result: `${fmtNum(iL, 2)} A`,
        },
        { label: "Tensión en terminales", result: `${fmtNum(v.v, 1)} V (${fmtNum(v.pct, 2)} % de ${fmtNum(v.vNom, 1)} V ${v.basis})` },
        { label: "Caída acumulada en conductores desde el origen de la zona", result: `${fmtNum(cum.get(id)!, 3)} %` },
      ];
      out.set(l, { elementId: l, currentA: iL, power: powerOf(s), voltage: v, cumulativeDropPct: cum.get(id), ratedCurrentA: lt.ratedCurrentA, traces: [lt.trace, { title: `${els.get(l)!.tag}: ${modeLabel}`, steps }] });
    }
  }

  for (const id of order.slice(1)) {
    const ed = edges.get(id)!;
    const node = nodes.get(id)!;
    const parent = nodes.get(ed.edge.parent)!;
    // Potencia que entra a la rama del lado de la fuente (en variadores/UPS, la de entrada).
    const s = sIn.get(id)!;
    const sChild = sNode.get(id)!;
    const iC = mode === "nominal" ? sChild.abs() / (node.m * node.vcNom) : iChild.get(id)!.abs();
    const sInP = sIn.get(id)!;
    const iP = mode === "nominal" ? sInP.abs() / (parent.m * parent.vcNom) : sInP.div(vc.get(ed.edge.parent)!.mul(parent.m)).conj().abs();
    const d = dropPctEdge.get(id) ?? 0;
    const steps = edgeSteps(ed, node, sChild, iC, iP, d, mode, norm.refs?.voltageDrop ?? []);
    const isTr = !!ed.tr;
    out.set(ed.el.id, {
      elementId: ed.el.id,
      currentA: ed.conv || isTr ? iP : iC,
      currentSecondaryA: isTr ? iC : undefined,
      power: powerOf(s),
      dropPct: ed.conv ? undefined : d,
      dropV: ed.conv ? undefined : (d / 100) * (node.m === 3 ? node.vNomLL : node.vcNom),
      voltage: voltageOf(node),
      cumulativeDropPct: cum.get(id),
      circuitKind: ed.circuitKind,
      traces: [...ed.traces, { title: `${ed.el.tag}: ${modeLabel}`, steps }],
    });
  }
  return { converged, iterations: mode === "nominal" ? 0 : iterations };
}

// ---------------------------------------------------------------- Datos de rama

function edgeData(
  edge: NetEdge,
  el: ProjectElement,
  parent: NetNode,
  child: NetNode,
  island: Island,
  nodes: Map<string, NetNode>,
  norm: NormModule,
  issues: LoadFlowIssue[],
  frequencyHz: number,
): EdgeData {
  const base: EdgeData = { edge, el, z: Complex.ZERO, k: child.m === 1 ? 2 : 1, ratio: 1, vScale: 1, traces: [], hasImpedance: false };
  // Escala de envío para un circuito monofásico derivado de un nodo trifásico o de 1F3H.
  if (child.circuit && !parent.circuit) base.vScale = child.vcNom / parent.vcNom;

  if (edge.role === "branch") {
    base.circuitKind = el.params.circuitKind === "alimentador" || el.params.circuitKind === "derivado" ? el.params.circuitKind : subtreeHasBus(edge.child, island, nodes) ? "alimentador" : "derivado";
    const size = el.params.forcedSize;
    const lengthM = n(el.params.lengthM);
    const npar = n(el.params.conductorsPerPhase, 1);
    if (typeof size !== "string") {
      issues.push({ severity: "warning", code: "sin-calibre", message: `${el.tag}: sin calibre; su caída de tensión no se calcula (el calibre se selecciona en la etapa E6 o se fija en "Calibre fijado").`, elementIds: [el.id] });
      return base;
    }
    const zi = norm.calc!.conductorImpedance({ designation: size, material: el.params.material === "Al" ? "Al" : "Cu", installationMethod: String(el.params.installationMethod ?? ""), frequencyHz: frequencyHz });
    if (!zi.ok) {
      issues.push({ severity: "error", code: "impedancia-conductor", message: `${el.tag}: ${zi.error}`, elementIds: [el.id] });
      return base;
    }
    const lkm = lengthM / 1000;
    base.z = new Complex((zi.rOhmPerKm * lkm) / npar, (zi.xOhmPerKm * lkm) / npar);
    base.hasImpedance = true;
    base.traces.push({
      title: `${el.tag}: impedancia del conductor`,
      steps: [
        { label: "Resistencia y reactancia por conductor", substitution: `${size} ${el.params.material === "Al" ? "Al" : "Cu"}, ${zi.column}, ${zi.temperatureC} °C`, result: `R = ${zi.rOhmPerKm} Ω/km ;  XL = ${zi.xOhmPerKm} Ω/km`, refs: [...zi.refs, ...zi.notes] },
        { label: "Impedancia del tramo", formula: "Z = (R + jXL) · L / n", substitution: `Z = (${zi.rOhmPerKm} + j${zi.xOhmPerKm}) · ${fmtNum(lkm, 4)} km / ${npar}`, result: `R = ${fmtNum(base.z.re, 5)} Ω ;  X = ${fmtNum(base.z.im, 5)} Ω` },
      ],
    });
    return base;
  }

  if (edge.role === "transformer") {
    const sn = n(el.params.ratedKVA) * 1000;
    const zPct = n(el.params.impedancePct);
    const xr = n(el.params.xrRatio);
    const tap = edge.reverse ? 0 : n(el.params.tapPct, 0);
    base.k = 1;
    base.ratio = child.vcNom / (parent.vcNom * (1 + tap / 100));
    if (!(xr > 0)) {
      issues.push({ severity: "error", code: "transformador-xr", message: `${el.tag}: falta la relación X/R (dato de placa o de fabricante); sin ella no se puede separar %Z en %R y %X.`, elementIds: [el.id] });
      return base;
    }
    const rPct = zPct / Math.sqrt(1 + xr * xr);
    const xPct = rPct * xr;
    const zb = (child.m * child.vcNom * child.vcNom) / sn;
    base.z = new Complex((rPct / 100) * zb, (xPct / 100) * zb);
    base.tr = { sn, rPct, xPct };
    base.hasImpedance = true;
    base.traces.push({
      title: `${el.tag}: impedancia del transformador`,
      steps: [
        { label: "Separación de %Z", formula: "%R = %Z / √(1 + (X/R)²) ;  %X = %R · X/R", substitution: `%R = ${zPct} / √(1 + ${xr}²)`, result: `%R = ${fmtNum(rPct, 4)} % ;  %X = ${fmtNum(xPct, 4)} %` },
        { label: "Impedancia base del secundario", formula: "Zb = V² / Sn", substitution: `Zb = ${fmtNum(child.m === 3 ? child.vNomLL : child.vcNom, 1)}² / ${fmtNum(sn, 0)}`, result: `${fmtNum(zb, 5)} Ω` },
        { label: "Impedancia referida al secundario", result: `R = ${fmtNum(base.z.re, 5)} Ω ;  X = ${fmtNum(base.z.im, 5)} Ω` },
      ],
    });
    return base;
  }

  if (edge.role === "converter") {
    const eta = n(el.params.efficiencyPct) / 100;
    const pfIn = n(el.params.inputPowerFactor);
    if (!(eta > 0 && eta <= 1) || !(pfIn > 0 && pfIn <= 1)) {
      issues.push({ severity: "error", code: "dato-convertidor", message: `${el.tag}: faltan la eficiencia o el factor de potencia de entrada.`, elementIds: [el.id] });
      base.conv = { eta: 1, pfIn: 1 };
      return base;
    }
    base.conv = { eta, pfIn };
    return base;
  }

  return base; // interruptores y ATS: sin impedancia
}

function subtreeHasBus(nodeId: string, island: Island, nodes: Map<string, NetNode>): boolean {
  if (nodes.get(nodeId)!.buses.length) return true;
  return (island.children.get(nodeId) ?? []).some((e) => e.role === "transformer" || subtreeHasBus(e.child, island, nodes));
}

function edgeSteps(ed: EdgeData, node: NetNode, s: Complex, iC: number, iP: number, d: number, mode: LoadFlowMode, vdRefs: string[]): TraceStep[] {
  const sm = s.abs();
  const cos = sm > 0 ? s.re / sm : 1;
  const sin = sm > 0 ? s.im / sm : 0;
  const steps: TraceStep[] = [
    { label: "Potencia aguas abajo", result: `P = ${fmtNum(s.re / 1000, 3)} kW ;  Q = ${fmtNum(s.im / 1000, 3)} kvar ;  S = ${fmtNum(sm / 1000, 3)} kVA ;  FP = ${fmtNum(cos, 4)}` },
  ];
  if (ed.conv) {
    steps.push({ label: "Potencia de entrada", formula: "P_ent = P_sal / η ;  Q_ent = P_ent · tan(arccos FP_ent)", substitution: `P_ent = ${fmtNum(s.re, 1)} / ${ed.conv.eta}`, result: `I_ent = ${fmtNum(iP, 2)} A`, refs: ["Salida regulada a su tensión nominal (supuesto)"] });
    return steps;
  }
  steps.push({
    label: "Corriente",
    formula: node.m === 3 ? "I = S / (√3 · V)" : "I = S / V",
    substitution: node.m === 3 ? `I = ${fmtNum(sm, 1)} / (√3 · ${fmtNum(node.vNomLL, 1)})` : `I = ${fmtNum(sm, 1)} / ${fmtNum(node.vcNom, 1)}`,
    result: `${fmtNum(iC, 2)} A${mode === "barrido" ? " (barrido, a la tensión calculada)" : ""}`,
  });
  if (ed.tr) {
    steps.push({ label: "Corriente del primario", result: `${fmtNum(iP, 2)} A` });
    steps.push({
      label: "Regulación del transformador",
      formula: "%ΔV ≈ (S / Sn) · (%R · cosφ + %X · senφ)",
      substitution: `%ΔV = (${fmtNum(sm, 0)} / ${fmtNum(ed.tr.sn, 0)}) · (${fmtNum(ed.tr.rPct, 4)} · ${fmtNum(cos, 4)} + ${fmtNum(ed.tr.xPct, 4)} · ${fmtNum(sin, 4)})`,
      result: `${fmtNum(d, 3)} %${mode === "barrido" ? " (barrido: diferencia de magnitudes)" : ""}`,
    });
    return steps;
  }
  if (!ed.hasImpedance) {
    steps.push({ label: "Caída de tensión", result: ed.edge.role === "branch" ? "No calculada (sin calibre)" : "Sin impedancia (0 %)" });
    return steps;
  }
  const ze = ed.z.re * cos + ed.z.im * sin;
  const vcN = node.vcNom;
  steps.push({
    label: "Caída de tensión (impedancia eficaz)",
    formula: node.m === 3 ? "ΔV = I · (R·cosφ + X·senφ) ;  %ΔV = ΔV / V_fn · 100" : "ΔV = 2 · I · (R·cosφ + X·senφ) ;  %ΔV = ΔV / V · 100",
    substitution: `ΔV = ${ed.k === 2 ? "2 · " : ""}${fmtNum(iC, 2)} · (${fmtNum(ed.z.re, 5)} · ${fmtNum(cos, 4)} + ${fmtNum(ed.z.im, 5)} · ${fmtNum(sin, 4)}) = ${fmtNum(ed.k * iC * ze, 3)} V ;  %ΔV = ${fmtNum(ed.k * iC * ze, 3)} / ${fmtNum(vcN, 2)} · 100`,
    result: `${fmtNum(mode === "nominal" ? d : (ed.k * iC * ze * 100) / vcN, 3)} %${mode === "barrido" ? ` (barrido fasorial: ${fmtNum(d, 3)} %)` : ""}`,
    refs: vdRefs,
  });
  return steps;
}

// ---------------------------------------------------------------- Verificación de criterios

function checkCriteria(project: Project, registry: ElementRegistry, norm: NormModule, els: Map<string, ProjectElement>, flows: Map<string, ElementFlow>, issues: LoadFlowIssue[]) {
  const s = project.settings.voltageDrop;
  const vd = norm.voltageDrop;
  const crit = (pct: number, base?: Criterion): Criterion => ({ pct, mandatory: false, source: base && base.pct === pct ? base.source : "criterio del proyecto" });
  const sensitive = vd?.special.find((x) => x.id === "electronico-sensible");
  const firePump = vd?.special.find((x) => x.id === "bomba-contra-incendio");

  const describe = (c: Criterion) => `${c.pct} % (${c.source}${c.mandatory ? ", obligatorio" : ""})`;

  for (const [id, f] of flows) {
    const el = els.get(id);
    if (!el) continue;
    const def = registry.get(el.type);

    // Caída por tramo de conductor.
    if (def.electricalRole === "branch" && f.dropPct !== undefined) {
      const limit = f.circuitKind === "derivado" ? crit(s.branchPct, vd?.branch) : crit(s.feederPct, vd?.feeder);
      if (f.dropPct > limit.pct + 1e-9) {
        issues.push({ severity: "error", code: "caida-tramo", message: `${el.tag} (${f.circuitKind}): caída de ${fmtNum(f.dropPct, 2)} % > ${describe(limit)}.`, elementIds: [id] });
      }
    }

    if (def.electricalRole !== "load" || f.cumulativeDropPct === undefined) continue;

    // Caída total en conductores (alimentador + derivado) dentro de la zona.
    const isSensitive = el.params.sensitiveElectronic === true;
    const total = isSensitive && sensitive?.total ? sensitive.total : crit(s.totalPct, vd?.total);
    if (f.cumulativeDropPct > total.pct + 1e-9) {
      issues.push({ severity: "error", code: "caida-total", message: `${el.tag}: caída total en conductores de ${fmtNum(f.cumulativeDropPct, 2)} % > ${describe(total)}.`, elementIds: [id] });
    }
    if (isSensitive && sensitive?.branch) {
      // Caída del circuito derivado que alimenta a la carga sensible.
      const branchDrop = feedingBranchDrop(id, project, flows, registry);
      if (branchDrop !== null && branchDrop > sensitive.branch.pct + 1e-9) {
        issues.push({ severity: "error", code: "caida-tramo", message: `${el.tag}: caída del circuito derivado de ${fmtNum(branchDrop, 2)} % > ${describe(sensitive.branch)}.`, elementIds: [id] });
      }
    }

    // Tensión en terminales contra la tolerancia del equipo (operación).
    const vRated = n(el.params.voltageV);
    if (f.voltage && vRated > 0) {
      const tol = def.calcBehavior === "load.motor" ? DEFAULT_EQUIPMENT_VOLTAGE.motor : DEFAULT_EQUIPMENT_VOLTAGE.other;
      const dev = ((f.voltage.v - vRated) / vRated) * 100;
      if (Math.abs(dev) > tol.continuousPct) {
        issues.push({
          severity: Math.abs(dev) > tol.limitPct ? "error" : "warning",
          code: "tension-terminales",
          message: `${el.tag}: tensión calculada en terminales ${fmtNum(f.voltage.v, 1)} V, ${dev > 0 ? "+" : "−"}${fmtNum(Math.abs(dev), 1)} % respecto a la placa (${vRated} V); tolerancia ±${tol.continuousPct} % / ±${tol.limitPct} % (${tol.source}).`,
          elementIds: [id],
        });
      }
    }

    // Bomba contra incendio: 695-7.
    if (el.params.firePump === true && firePump?.motorRunning && f.voltage) {
      const k = firePump.motorRunning.atCurrentPctOfFlc / 100;
      const vAt = f.voltage.vNom * (1 - (k * (100 - f.voltage.pct)) / 100);
      const minV = vRated * (1 - firePump.motorRunning.pct / 100);
      if (vAt < minV) {
        issues.push({
          severity: "error",
          code: "bomba-contra-incendio",
          message: `${el.tag}: a ${firePump.motorRunning.atCurrentPctOfFlc} % de la corriente de plena carga la tensión estimada en terminales es ${fmtNum(vAt, 1)} V < ${fmtNum(minV, 1)} V (${describe(firePump.motorRunning)}). Estimación lineal de la caída con la corriente.`,
          elementIds: [id],
        });
      }
      if (firePump.motorStarting) {
        issues.push({ severity: "info", code: "bomba-contra-incendio", message: `${el.tag}: la verificación en arranque (${describe(firePump.motorStarting)}) requiere el estudio de arranque de motores (fase posterior).`, elementIds: [id] });
      }
    }
  }
}

/** Caída del cable que alimenta directamente a una carga (circuito derivado), o null. */
function feedingBranchDrop(loadId: string, project: Project, flows: Map<string, ElementFlow>, registry: ElementRegistry): number | null {
  // El cable cuyo extremo de carga es el nodo de la carga, siguiendo interruptores.
  const els = new Map(project.elements.map((e) => [e.id, e]));
  let target: { elementId: string; portId: string } = { elementId: loadId, portId: "in" };
  for (let guard = 0; guard < 10; guard++) {
    const c = project.connections.find((x) => (x.a.elementId === target.elementId && x.a.portId === target.portId) || (x.b.elementId === target.elementId && x.b.portId === target.portId));
    if (!c) return null;
    const other = c.a.elementId === target.elementId && c.a.portId === target.portId ? c.b : c.a;
    const el = els.get(other.elementId)!;
    const def = registry.get(el.type);
    if (def.electricalRole === "branch") return flows.get(el.id)?.dropPct ?? null;
    const link = (def.internalLinks ?? []).find((l) => l.a === other.portId || l.b === other.portId);
    if (!link || def.electricalRole !== "switch") return null;
    target = { elementId: el.id, portId: link.a === other.portId ? link.b : link.a };
  }
  return null;
}
