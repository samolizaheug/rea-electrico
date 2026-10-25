import { validateParams, type ParamIssue, type ParamValue, type Project } from "@rea/core";
import {
  DEFAULT_EQUIPMENT_VOLTAGE,
  panelSchedules,
  runSizing,
  scheduleIssues,
  validateDesignCriteria,
  validateTopology,
  type ElementFlow,
  type NormModule,
  type PanelSchedule,
  type SizingRunResult,
  type TopologyReport,
} from "@rea/engine";
import { getNormModule } from "@rea/norms";
import { useMemo } from "react";
import { registry } from "./registry";
import { useProject } from "./store";

export interface UiIssue {
  severity: "error" | "warning" | "info";
  origin: "parametros" | "topologia" | "criterios" | "calculo";
  message: string;
  elementIds: string[];
  /** Parámetro afectado (solo en problemas de parámetros). */
  paramKey?: string;
}

/** Resultados del cálculo (flujo de carga + dimensionamiento + cuadros). */
export interface Results {
  sizing: SizingRunResult;
  schedules: PanelSchedule[];
  /** Resultado del flujo final por elemento. */
  flow: (id: string) => ElementFlow | undefined;
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
  /** null si hay errores que impiden calcular. */
  results: Results | null;
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

  // El cálculo se ejecuta solo si los datos y la topología no tienen errores.
  let results: Results | null = null;
  const blocking = issues.some((i) => i.severity === "error");
  if (!blocking && norm.available && project.elements.length) {
    const sizing = runSizing(project, registry, norm);
    if (sizing.calculated) {
      const schedules = panelSchedules(project, registry, sizing.loadFlow, sizing);
      results = { sizing, schedules, flow: (id) => sizing.loadFlow.elements.get(id) };
      for (const i of scheduleIssues(schedules)) issues.push({ severity: i.severity, origin: "calculo", message: i.message, elementIds: i.elementIds });
    }
    for (const i of sizing.issues) issues.push({ severity: i.severity, origin: "calculo", message: i.message, elementIds: i.elementIds });
  }

  const rank = { error: 0, warning: 1, info: 2 } as const;
  issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const byElement = new Map<string, "error" | "warning">();
  for (const i of issues) {
    if (i.severity === "info") continue;
    for (const id of i.elementIds) if (byElement.get(id) !== "error") byElement.set(id, i.severity);
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return { norm, topology, issues, byElement, paramIssues, errors, warnings, results };
}

// El análisis no depende del dibujo: se recalcula solo si cambian elementos, conexiones o configuración
// (mover símbolos no dispara el cálculo).
let cached: { key: [unknown, unknown, unknown]; value: ValidationState } | null = null;
export function validationFor(project: Project): ValidationState {
  const key: [unknown, unknown, unknown] = [project.elements, project.connections, project.settings];
  if (!cached || cached.key.some((k, i) => k !== key[i])) cached = { key, value: computeValidation(project) };
  return cached.value;
}

/** Validación y resultados del proyecto actual. */
export function useValidation(): ValidationState {
  const project = useProject();
  return useMemo(() => validationFor(project), [project.elements, project.connections, project.settings]);
}
