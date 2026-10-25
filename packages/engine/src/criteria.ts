import type { Project } from "@rea/core";
import type { VoltageDropCriteria } from "./norm-module";

export interface CriteriaIssue {
  code: "criterio-excede-norma";
  severity: "error";
  message: string;
  /** Campo de la configuración afectado. */
  setting: "voltageDrop.branchPct" | "voltageDrop.feederPct" | "voltageDrop.totalPct";
}

/**
 * Los criterios del proyecto pueden ser más estrictos que la norma, pero nunca más
 * permisivos: un límite de caída mayor al de la norma es un error.
 */
export function validateDesignCriteria(project: Project, vd: VoltageDropCriteria | undefined): CriteriaIssue[] {
  if (!vd) return [];
  const s = project.settings.voltageDrop;
  const checks = [
    ["voltageDrop.branchPct", "circuito derivado", s.branchPct, vd.branch],
    ["voltageDrop.feederPct", "alimentador", s.feederPct, vd.feeder],
    ["voltageDrop.totalPct", "total (alimentador + derivado)", s.totalPct, vd.total],
  ] as const;
  const issues: CriteriaIssue[] = [];
  for (const [setting, what, value, limit] of checks) {
    if (value > limit.pct) {
      issues.push({
        code: "criterio-excede-norma",
        severity: "error",
        setting,
        message: `El límite de caída de tensión del ${what} (${value} %) excede el de la norma (${limit.pct} %, ${limit.source}).`,
      });
    }
  }
  return issues;
}
