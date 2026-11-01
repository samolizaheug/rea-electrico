import { updateParams, updateSettings, type ParamValue, type Project } from "@rea/core";
import { registry } from "./registry";
import { computeValidation, optionContext, type UiIssue, type ValidationState } from "./validation";

/** Corrección propuesta: qué cambia (en palabras) y cómo aplicarla al proyecto. */
export interface Fix {
  label: string;
  apply(project: Project): Project;
}

/**
 * Cómo resolver cada tipo de observación. Son recomendaciones de diseño, no valores de norma:
 * los límites y artículos ya vienen en el mensaje de la observación.
 */
const isDropMessage = (m: string) => /caída de tensión/.test(m);
/** Ningún calibre alcanza la corriente: se resuelve con conductores en paralelo. */
const isParallelMessage = (m: string) => /ningún calibre/.test(m);

const HINTS: Record<string, string> = {
  parametro: "Corrija el dato marcado en «Propiedades» del elemento.",
  "puerto-sin-conectar": "Conecte el punto libre: jale el cable desde el punto del elemento y suéltelo sobre la barra o el equipo que lo alimenta. Si no se usa, elimine el elemento.",
  "sin-fuente": "Conecte el elemento a un tablero o barra que tenga alimentación (acometida, generador o transformador).",
  desenergizado: "Cierre el interruptor abierto o cambie la posición del ATS si el elemento debe quedar energizado.",
  lazo: "Abra un interruptor del lazo o elimine la conexión redundante: el cálculo solo resuelve redes radiales.",
  "fuentes-en-paralelo": "Use un ATS para elegir la fuente o abra el interruptor de una de ellas.",
  "alimentacion-inversa": "Conecte la alimentación al lado de línea (primario o entrada) y la carga al lado de carga.",
  "tension-incompatible": "Iguale la tensión nominal de ambos elementos o intercale un transformador entre ellos.",
  "sistema-incompatible": "Iguale el sistema (fases e hilos) de ambos elementos, o alimente la carga desde un tablero con el sistema que requiere.",
  "tension-fuera-de-tolerancia": "Verifique la tensión de placa del equipo; si es correcta, ajuste el tap del transformador que lo alimenta o elija un equipo con la tensión del sistema.",
  "tension-terminales": "Aumente el calibre de los cables del recorrido (empezando por el más cargado o más largo), acorte la trayectoria o ajuste el tap del transformador que lo alimenta.",
  "caida-tramo": "Aumente el calibre del cable (o use conductores en paralelo) o acorte la trayectoria.",
  "caida-total": "Reparta la caída: aumente el calibre del alimentador o del derivado, o acorte alguna de las trayectorias.",
  "sin-calibre": "Corra el cálculo sin errores para que se seleccione el calibre, o fije uno en «Calibre fijado».",
  "impedancia-conductor": "Revise el calibre, el material y el método de instalación del cable.",
  "transformador-xr": "Capture la relación X/R de placa o las pérdidas en el cobre del protocolo de pruebas.",
  "dato-aproximado": "El cálculo usó un valor estimado: capture el dato de placa o del protocolo de pruebas para quitar la estimación.",
  "dato-carga": "Complete los datos de placa de la carga (potencia, tensión, factor de potencia).",
  "dato-convertidor": "Capture la eficiencia y el factor de potencia de entrada del convertidor.",
  "polos-interruptor": "Iguale el número de polos del interruptor al número de fases del circuito.",
  "marco-interruptor": "Capture un marco igual o mayor que la capacidad de disparo, o deje el marco vacío (igual a la capacidad).",
  dimensionamiento: "Revise los datos del circuito (longitud, método de instalación, temperatura, agrupamiento) o fije el calibre a mano.",
  "ccm-bus-vertical": "Aumente la capacidad del bus vertical de esa sección o reparta las cargas entre secciones.",
  "ccm-bus-horizontal": "Aumente la capacidad del bus horizontal del CCM o reparta las cargas en otro CCM.",
  "ccm-430-94": "Use una protección del alimentador que no exceda la barra común del CCM, o un CCM con bus horizontal mayor.",
  "ccm-configuracion": "Revise el número de secciones del CCM y la sección de cada interruptor.",
  "cable-mt-en-bt": "Reemplace el cable de media tensión por «Alimentador (cable)», que sí se dimensiona en baja tensión.",
  "aislamiento-mt": "Elija una clase de aislamiento igual o mayor que la tensión del sistema.",
  "cable-mt": "El cable de media tensión no se dimensiona automáticamente: verifique su calibre con el fabricante.",
  "criterio-excede-norma": "Baje el límite de caída de tensión de los criterios de diseño al valor de la norma o menor.",
  "bomba-contra-incendio": "Aumente el calibre del circuito de la bomba o acorte su trayectoria; el arranque requiere el estudio de arranque de motores.",
  desbalance: "Reacomode los circuitos monofásicos entre las fases del tablero para balancear la carga.",
  "no-converge": "Revise impedancias o cargas fuera de rango (cables muy largos, transformadores muy pequeños).",
  "norma-sin-datos": "Elija una norma con datos cargados en «Criterios de diseño».",
};

export function hintFor(issue: UiIssue, project: Project): string {
  if (issue.code === "parametro" && issue.paramKey) {
    const el = project.elements.find((e) => e.id === issue.elementIds[0]);
    const label = (el && registry.tryGet(el.type)?.params.find((p) => p.key === issue.paramKey)?.label) ?? issue.paramKey;
    return `Corrija el campo «${label}» en «Propiedades» del elemento.`;
  }
  if (issue.code === "dimensionamiento" && isDropMessage(issue.message)) return HINTS["caida-tramo"]!;
  if (issue.code === "dimensionamiento" && isParallelMessage(issue.message))
    return "Es un problema de ampacidad, no de longitud: la corriente del circuito excede la del calibre más grande disponible en estas condiciones. Use conductores en paralelo («Conductores por fase») o reparta la carga en dos circuitos.";
  return (issue.code && HINTS[issue.code]) || "Revise los datos del elemento señalado.";
}

/** Tipos de observación para los que se buscan correcciones automáticas. */
const FIXABLE = new Set(["dimensionamiento", "polos-interruptor", "marco-interruptor", "tension-terminales", "caida-tramo", "caida-total", "bomba-contra-incendio", "criterio-excede-norma", "aislamiento-mt"]);
export const canSearchFix = (issue: UiIssue) =>
  !!issue.code && FIXABLE.has(issue.code) && (issue.code !== "dimensionamiento" || isDropMessage(issue.message) || isParallelMessage(issue.message));

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** El dimensionamiento de un cable da varias observaciones distintas con el mismo código: se separan por tema. */
export const sameKind = (a: UiIssue, b: UiIssue) =>
  a.code === b.code &&
  sameIds(a.elementIds, b.elementIds) &&
  (b.setting === undefined || a.setting === b.setting) &&
  (a.code !== "dimensionamiento" || (isDropMessage(a.message) === isDropMessage(b.message) && isParallelMessage(a.message) === isParallelMessage(b.message)));

/** La observación desaparece y no aparecen errores nuevos. */
function resolves(issue: UiIssue, base: ValidationState, next: ValidationState): boolean {
  if (next.issues.some((i) => sameKind(i, issue))) return false;
  return next.errors <= base.errors;
}

/** Elementos entre `id` y su fuente (incluida), del más cercano a `id` al más lejano. */
function pathToSource(project: Project, v: ValidationState, id: string): string[] {
  const source = v.topology.sourceOf.get(id);
  if (!source) return [];
  const adj = new Map<string, string[]>();
  for (const c of project.connections) {
    (adj.get(c.a.elementId) ?? adj.set(c.a.elementId, []).get(c.a.elementId)!).push(c.b.elementId);
    (adj.get(c.b.elementId) ?? adj.set(c.b.elementId, []).get(c.b.elementId)!).push(c.a.elementId);
  }
  const parent = new Map<string, string>([[id, id]]);
  const queue = [id];
  while (queue.length) {
    const x = queue.shift()!;
    if (x === source) break;
    for (const y of adj.get(x) ?? []) {
      if (parent.has(y)) continue;
      parent.set(y, x);
      queue.push(y);
    }
  }
  if (!parent.has(source)) return [];
  // Se recorre de la fuente hacia el elemento y se invierte: del más cercano al elemento a la fuente.
  const back: string[] = [];
  for (let x = source; x !== id; x = parent.get(x)!) back.push(x);
  return back.reverse();
}

const setParams = (id: string, changes: Record<string, ParamValue>) => (p: Project) => updateParams(p, id, changes);

/**
 * Grupo de correcciones alternativas en orden (de menor a mayor cambio). «kind» agrupa las que compiten
 * entre sí: de cada kind se ofrece la que requiere menos pasos. «monotonic» = si una funciona, las
 * siguientes también (un calibre mayor no empeora la caída), y se busca por mitades.
 */
interface Group {
  kind: string;
  fixes: Fix[];
  monotonic?: boolean;
}

/** Correcciones candidatas para una observación. */
function candidates(issue: UiIssue, project: Project, v: ValidationState): Group[] {
  const id = issue.elementIds[0];
  const el = project.elements.find((e) => e.id === id);
  switch (issue.code) {
    case "polos-interruptor": {
      const phases = /lleva ([0-9]+) conductor/.exec(issue.message)?.[1];
      if (!el || !phases) return [];
      return [{ kind: "polos", fixes: [{ label: `${el.tag}: polos ${String(el.params.poles)} → ${phases}`, apply: setParams(el.id, { poles: phases }) }] }];
    }
    case "marco-interruptor":
      if (!el) return [];
      return [{ kind: "marco", fixes: [{ label: `${el.tag}: corriente de marco ${String(el.params.frameA)} A → vacía (igual a la capacidad de disparo)`, apply: setParams(el.id, { frameA: null }) }] }];
    case "criterio-excede-norma": {
      const vd = v.norm.voltageDrop;
      const field = issue.setting?.split(".")[1] as "branchPct" | "feederPct" | "totalPct" | undefined;
      if (!vd || !field) return [];
      const limit = { branchPct: vd.branch, feederPct: vd.feeder, totalPct: vd.total }[field].pct;
      const cur = project.settings.voltageDrop[field];
      return [{ kind: "criterio", fixes: [{ label: `Límite de caída ${cur} % → ${limit} % (el de la norma)`, apply: (p) => updateSettings(p, { voltageDrop: { ...p.settings.voltageDrop, [field]: limit } }) }] }];
    }
    case "aislamiento-mt": {
      if (!el) return [];
      const opts = registry.tryGet(el.type)?.params.find((p) => p.key === "insulationKV");
      if (!opts || opts.kind !== "enum" || !Array.isArray(opts.options)) return [];
      const cur = Number(el.params.insulationKV);
      const fixes = opts.options
        .map((o) => o.value)
        .filter((x) => Number(x) > cur)
        .sort((a, b) => Number(a) - Number(b))
        .map((x) => ({ label: `${el.tag}: aislamiento ${cur} kV → ${x} kV`, apply: setParams(el.id, { insulationKV: x }) }));
      return [{ kind: "aislamiento", fixes, monotonic: true }];
    }
    case "dimensionamiento":
      if (isParallelMessage(issue.message)) {
        const cable = issue.elementIds.map((x) => project.elements.find((e) => e.id === x)).find((e) => e?.type === "cable");
        if (!cable) return [];
        const cur = typeof cable.params.conductorsPerPhase === "number" ? cable.params.conductorsPerPhase : 1;
        const fixes = Array.from({ length: 12 - cur }, (_, k) => cur + k + 1).map((n) => ({
          label: `${cable.tag}: ${n} conductores por fase en paralelo (antes ${cur})`,
          apply: setParams(cable.id, { conductorsPerPhase: n }),
        }));
        return [{ kind: "paralelo", fixes, monotonic: true }];
      }
      if (!isDropMessage(issue.message)) return [];
      return voltageGroups(project, v, issue.elementIds);
    case "tension-terminales":
    case "caida-tramo":
    case "caida-total":
    case "bomba-contra-incendio":
      return voltageGroups(project, v, issue.elementIds);
    default:
      return [];
  }
}

/** Caída o tensión baja: un calibre mayor en algún cable del recorrido, o el tap del transformador. */
function voltageGroups(project: Project, v: ValidationState, ids: string[]): Group[] {
  const id = ids[0];
  if (!id) return [];
  const el = project.elements.find((e) => e.id === id);
  const path = pathToSource(project, v, id);
  const typeOf = (x: string) => project.elements.find((e) => e.id === x)?.type;
  const cables = (el?.type === "cable" ? [id] : []).concat(path.filter((x) => x !== id && typeOf(x) === "cable"));
  const groups: Group[] = [];
  for (const cid of cables) {
    const c = project.elements.find((e) => e.id === cid)!;
    const sizes = v.norm.options("norm:conductorSizes", optionContext(c.params, v.topology, cid))?.filter((o) => !o.disabled).map((o) => o.value) ?? [];
    const current = typeof c.params.forcedSize === "string" ? c.params.forcedSize : v.results?.sizing.circuits.get(cid)?.conductor.designation;
    const at = current ? sizes.indexOf(current) : -1;
    if (at < 0) continue;
    const fixes = sizes.slice(at + 1).map((next) => ({ label: `${c.tag}: calibre ${current} → ${next} (calibre fijado)`, apply: setParams(cid, { forcedSize: next }) }));
    groups.push({ kind: "calibre", fixes, monotonic: true });
  }
  // Tap del transformador que lo alimenta (pasos de 2.5 %; verifique que su equipo los tenga).
  for (const tid of path.filter((x) => typeOf(x) === "transformer")) {
    const t = project.elements.find((e) => e.id === tid)!;
    const cur = typeof t.params.tapPct === "number" ? t.params.tapPct : 0;
    const fixes = [-2.5, 2.5, -5, 5]
      .map((d) => cur + d)
      .filter((x) => x >= -10 && x <= 10)
      .map((next) => ({ label: `${t.tag}: tap ${cur} % → ${next} % (verifique que el transformador tenga esa derivación)`, apply: setParams(tid, { tapPct: next }) }));
    groups.push({ kind: "tap", fixes });
  }
  return groups;
}

/**
 * Busca correcciones que resuelvan la observación: prueba las candidatas sobre una copia del proyecto
 * con el mismo cálculo. De cada tipo (calibre, tap…) ofrece la que requiere el menor cambio.
 */
export function searchFixes(issue: UiIssue, project: Project, base: ValidationState): Fix[] {
  const works = (fix: Fix) => {
    try {
      return resolves(issue, base, computeValidation(fix.apply(project)));
    } catch {
      return false;
    }
  };
  const best = new Map<string, { fix: Fix; steps: number }>();
  for (const g of candidates(issue, project, base)) {
    let at = -1;
    if (g.monotonic) {
      // Primer índice que funciona (si el último no funciona, ninguno lo hace).
      let lo = 0;
      let hi = g.fixes.length - 1;
      if (hi < 0 || !works(g.fixes[hi]!)) continue;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (works(g.fixes[mid]!)) hi = mid;
        else lo = mid + 1;
      }
      at = lo;
    } else {
      at = g.fixes.findIndex(works);
    }
    if (at < 0) continue;
    const prev = best.get(g.kind);
    if (!prev || at < prev.steps) best.set(g.kind, { fix: g.fixes[at]!, steps: at });
  }
  return [...best.values()].map((b) => b.fix);
}
