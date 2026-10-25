import { updateParams, updateSettings, type ParamValue, type Project } from "@rea/core";
import type { NormModule } from "@rea/engine";
import { registry } from "./registry";

export interface NormSwitchChange {
  elementId: string;
  tag: string;
  params: Record<string, ParamValue>;
}

/**
 * Adapta el proyecto a otra norma:
 * - parámetros cuyas opciones vienen de la norma (aislamiento, método, calibre, canalización) y cuyo
 *   valor no existe en la nueva norma: se reemplazan por el valor por defecto de la norma (o se vacían);
 * - límites de caída de tensión del proyecto mayores que los de la nueva norma: se reducen al de la norma.
 * Devuelve el proyecto adaptado y la lista de cambios por elemento, para confirmarlos con el usuario.
 */
export function adaptToNorm(project: Project, norm: NormModule): { project: Project; changes: NormSwitchChange[]; settingsChanged: string[] } {
  let p = updateSettings(project, { norm: { id: norm.id, edition: norm.edition } });
  const changes: NormSwitchChange[] = [];
  // Entre normas distintas los calibres no son comparables aunque coincida el texto
  // ("4" AWG ≠ "4" mm²): los calibres fijados siempre se vacían.
  const otherFamily = project.settings.norm.id !== norm.id;
  for (const el of project.elements) {
    const def = registry.tryGet(el.type);
    if (!def) continue;
    const defaults = norm.paramDefaults(el.type);
    const params = { ...el.params };
    const changed: Record<string, ParamValue> = {};
    // En orden de definición: el método se corrige antes de evaluar las medidas de canalización.
    for (const pd of def.params) {
      if (pd.kind !== "enum" || Array.isArray(pd.options) || !pd.options || !("provider" in pd.options)) continue;
      const v = params[pd.key];
      if (v === null || v === undefined) continue;
      const allowed = norm.options(pd.options.provider, params);
      const sizeAcrossNorms = otherFamily && pd.options.provider === "norm:conductorSizes";
      if (!sizeAcrossNorms && (!allowed || allowed.some((o) => o.value === v))) continue;
      const next = sizeAcrossNorms ? null : (defaults[pd.key] ?? null);
      params[pd.key] = next;
      changed[pd.key] = next;
    }
    if (Object.keys(changed).length) {
      p = updateParams(p, el.id, changed);
      changes.push({ elementId: el.id, tag: el.tag, params: changed });
    }
  }
  const settingsChanged: string[] = [];
  const vd = norm.voltageDrop;
  if (vd) {
    const s = p.settings.voltageDrop;
    const next = { branchPct: Math.min(s.branchPct, vd.branch.pct), feederPct: Math.min(s.feederPct, vd.feeder.pct), totalPct: Math.min(s.totalPct, vd.total.pct) };
    if (next.branchPct !== s.branchPct) settingsChanged.push(`derivado ${s.branchPct} → ${next.branchPct} %`);
    if (next.feederPct !== s.feederPct) settingsChanged.push(`alimentador ${s.feederPct} → ${next.feederPct} %`);
    if (next.totalPct !== s.totalPct) settingsChanged.push(`total ${s.totalPct} → ${next.totalPct} %`);
    if (settingsChanged.length) p = updateSettings(p, { voltageDrop: next });
  }
  return { project: p, changes, settingsChanged };
}
