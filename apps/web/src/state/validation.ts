import { validateParams, type ParamIssue, type ParamValue, type Project } from "@rea/core";
import { DEFAULT_EQUIPMENT_VOLTAGE, validateDesignCriteria, validateTopology, type NormModule, type TopologyReport } from "@rea/engine";
import { getNormModule } from "@rea/norms";
import { useMemo } from "react";
import { registry } from "./registry";
import { useProject } from "./store";

export interface UiIssue {
  severity: "error" | "warning";
  origin: "parametros" | "topologia" | "criterios";
  message: string;
  elementIds: string[];
  /** Parámetro afectado (solo en problemas de parámetros). */
  paramKey?: string;
}

export interface ValidationState {
  norm: NormModule;
  topology: TopologyReport;
  issues: UiIssue[];
  /** Severidad más alta por elemento (para marcar el diagrama). */
  byElement: Map<string, "error" | "warning">;
  paramIssues: Map<string, ParamIssue[]>;
  errors: number;
  warnings: number;
}

export function normOf(project: Project): NormModule {
  return getNormModule(project.settings.norm.id, project.settings.norm.edition);
}

export function computeValidation(project: Project): ValidationState {
  const norm = normOf(project);
  const resolve = (provider: string, params: Record<string, ParamValue>) => norm.options(provider, params)?.map((o) => o.value);
  const issues: UiIssue[] = [];
  const paramIssues = new Map<string, ParamIssue[]>();

  for (const el of project.elements) {
    const def = registry.tryGet(el.type);
    if (!def) continue;
    const list = validateParams(def, el.params, resolve).filter((i) => !i.message.startsWith("Parámetro desconocido"));
    if (!list.length) continue;
    paramIssues.set(el.id, list);
    for (const i of list) issues.push({ severity: i.severity, origin: "parametros", message: `${el.tag}: ${i.message}`, elementIds: [el.id], paramKey: i.key });
  }

  const topology = validateTopology(project, registry, DEFAULT_EQUIPMENT_VOLTAGE);
  for (const i of topology.issues) issues.push({ severity: i.severity, origin: "topologia", message: i.message, elementIds: i.elementIds });
  for (const i of validateDesignCriteria(project, norm.voltageDrop)) issues.push({ severity: i.severity, origin: "criterios", message: i.message, elementIds: [] });
  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));

  const byElement = new Map<string, "error" | "warning">();
  for (const i of issues) {
    for (const id of i.elementIds) if (byElement.get(id) !== "error") byElement.set(id, i.severity);
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  return { norm, topology, issues, byElement, paramIssues, errors, warnings: issues.length - errors };
}

// Varios componentes leen la validación; se calcula una sola vez por versión del proyecto.
let cached: { project: Project; value: ValidationState } | null = null;
function validationFor(project: Project): ValidationState {
  if (cached?.project !== project) cached = { project, value: computeValidation(project) };
  return cached.value;
}

/** Validación del proyecto actual; se recalcula solo cuando cambia el proyecto. */
export function useValidation(): ValidationState {
  const project = useProject();
  return useMemo(() => validationFor(project), [project]);
}
