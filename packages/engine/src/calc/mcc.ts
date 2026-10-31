import type { Project } from "@rea/core";
import type { NormModule, SizingCircuit } from "../norm-module";
import { fmtNum } from "../trace";
import type { LoadFlowIssue } from "./loadflow";

/** Carga de una sección vertical del CCM frente a su bus vertical. */
export interface MccSectionCheck {
  section: number;
  /** Circuitos (etiqueta del interruptor o del cable) que salen de la sección. */
  circuits: string[];
  /** Carga calculada con la regla de la norma para alimentadores (A). */
  designA: number;
  rule: string;
  /** Valor nominal del bus vertical de la sección (A), si se capturó. */
  ratingA?: number;
}

export interface MccCheck {
  mccId: string;
  tag: string;
  sections: MccSectionCheck[];
  /** Carga total del CCM frente al bus horizontal (barra común de potencia). */
  total: { designA: number; rule: string; ratingA?: number };
  /** Protección que alimenta al CCM (430-94). */
  feederProtectionA?: number;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * Verifica las barras de cada CCM: la carga de cada sección (circuitos que salen de ella) contra su bus
 * vertical y la carga total contra el bus horizontal, ambas calculadas como un alimentador con la regla de
 * la norma (NOM: 430-24, 125 % del motor mayor más los demás); y que la protección que alimenta al CCM no
 * exceda el valor de la barra común de potencia (NOM 430-94).
 */
export function checkMccs(
  project: Project,
  sizingCircuits: SizingCircuit[],
  protectionOf: (cableId: string) => number | undefined,
  norm: NormModule,
): { checks: Map<string, MccCheck>; issues: LoadFlowIssue[] } {
  const checks = new Map<string, MccCheck>();
  const issues: LoadFlowIssue[] = [];
  if (!norm.sizing) return { checks, issues };
  const designOf = (base: SizingCircuit, tag: string, list: SizingCircuit[]) => {
    const synthetic: SizingCircuit = {
      ...base,
      tag,
      circuitKind: "alimentador",
      breaker: undefined,
      transformerSecondary: false,
      items: list.flatMap((c) => c.items),
      downstreamMotorProtection: list.flatMap((c) => c.downstreamMotorProtection),
    };
    const p = norm.sizing!.protection(synthetic);
    return { designA: p.designA, rule: p.rule };
  };

  for (const m of project.elements.filter((e) => e.type === "mcc")) {
    const n = Math.max(1, Math.round(num(m.params.sections) ?? 1));
    const out = sizingCircuits.filter((c) => c.originBusIds?.includes(m.id));
    if (!out.length) continue;

    // Bus vertical por sección: un valor común o una lista separada por comas.
    const common = num(m.params.verticalBusA);
    let bySection: (number | undefined)[] = Array.from({ length: n }, () => common);
    const list = String(m.params.verticalBusBySection ?? "").trim();
    if (list) {
      const vals = list.split(/[,;]/).map((x) => Number(x.trim()));
      if (vals.length !== n || vals.some((v) => !(v > 0))) {
        issues.push({ severity: "warning", code: "ccm-configuracion", message: `${m.tag}: «Bus vertical por sección» debe tener ${n} valor(es) en A separados por comas; se usa el valor común.`, elementIds: [m.id] });
      } else bySection = vals;
    }

    // Sección de cada circuito: la del interruptor de origen (o la 1 si el CCM tiene una sola sección).
    const groups = new Map<number, SizingCircuit[]>();
    const unassigned: string[] = [];
    for (const c of out) {
      const s = num(c.breaker?.params.mccSection) ?? (n === 1 ? 1 : undefined);
      const label = c.breaker?.tag ?? c.tag;
      if (s === undefined) {
        unassigned.push(label);
        continue;
      }
      if (s > n || s < 1) {
        issues.push({ severity: "error", code: "ccm-configuracion", message: `${label}: está en la sección ${s}, pero ${m.tag} tiene ${n} sección(es).`, elementIds: [m.id, c.breaker?.elementId ?? c.cableId] });
        continue;
      }
      (groups.get(s) ?? groups.set(s, []).get(s)!).push(c);
    }
    if (unassigned.length) {
      issues.push({ severity: "warning", code: "ccm-configuracion", message: `${m.tag}: indique la «Sección del CCM» en ${unassigned.join(", ")} para verificar los buses verticales.`, elementIds: [m.id] });
    }

    const sections: MccSectionCheck[] = [];
    for (const [s, list] of [...groups].sort((a, b) => a[0] - b[0])) {
      const d = designOf(list[0]!, `${m.tag} sección ${s}`, list);
      const ratingA = bySection[s - 1];
      sections.push({ section: s, circuits: list.map((c) => c.breaker?.tag ?? c.tag), designA: d.designA, rule: d.rule, ratingA });
      if (ratingA !== undefined && d.designA > ratingA + 1e-9) {
        issues.push({
          severity: "warning",
          code: "ccm-bus-vertical",
          message: `${m.tag} sección ${s}: la carga calculada (${fmtNum(d.designA, 1)} A, ${d.rule}) excede el bus vertical de ${ratingA} A.`,
          elementIds: [m.id, ...list.map((c) => c.breaker?.elementId ?? c.cableId)],
        });
      }
    }

    const t = designOf(out[0]!, `${m.tag} total`, out);
    // Proyectos anteriores guardaban la capacidad del CCM en «busRatingA».
    const hA = num(m.params.horizontalBusA) ?? num(m.params.busRatingA);
    if (hA !== undefined && t.designA > hA + 1e-9) {
      issues.push({ severity: "warning", code: "ccm-bus-horizontal", message: `${m.tag}: la carga total calculada (${fmtNum(t.designA, 1)} A, ${t.rule}) excede el bus horizontal de ${hA} A.`, elementIds: [m.id] });
    }

    // 430-94: la protección del CCM no debe exceder el valor de la barra común de potencia.
    const feeder = sizingCircuits.find((c) => c.destinationBusIds?.includes(m.id));
    const feederA = feeder ? protectionOf(feeder.cableId) : undefined;
    if (norm.id === "nom-001-sede" && hA !== undefined && feederA !== undefined && feederA > hA + 1e-9) {
      issues.push({
        severity: "error",
        code: "ccm-430-94",
        message: `${m.tag}: la protección que lo alimenta (${feeder!.breaker?.tag ?? feeder!.tag}, ${feederA} A) excede el valor de la barra común de potencia (${hA} A) — NOM-001-SEDE-2012 430-94.`,
        elementIds: [m.id, ...(feeder?.breaker ? [feeder.breaker.elementId] : [])],
      });
    }
    checks.set(m.id, { mccId: m.id, tag: m.tag, sections, total: { designA: t.designA, rule: t.rule, ratingA: hA }, feederProtectionA: feederA });
  }
  return { checks, issues };
}
