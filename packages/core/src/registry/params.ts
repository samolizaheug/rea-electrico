import type { ElementTypeDefinition, ParamDef, ParamValue } from "./definition";

export interface ParamIssue {
  key: string;
  severity: "error" | "warning";
  message: string;
}

/**
 * Resuelve las opciones de un enum con proveedor (p. ej. "norm:installationMethods").
 * Recibe los parámetros actuales del elemento porque algunas opciones dependen de otros
 * datos (las medidas de canalización dependen del método de instalación).
 * Si no se pasa resolvedor, las opciones con proveedor no se validan.
 */
export type OptionsResolver = (provider: string, params: Record<string, ParamValue>) => string[] | undefined;

/** Construye el juego de parámetros por defecto de un tipo. */
export function defaultParams(def: ElementTypeDefinition): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of def.params) out[p.key] = paramDefault(p);
  return out;
}

export function paramDefault(p: ParamDef): ParamValue {
  switch (p.kind) {
    case "number":
      return p.default ?? null;
    case "enum":
      return p.default ?? null;
    case "boolean":
      return p.default ?? false;
    case "string":
      return p.default ?? "";
  }
}

/** Indica si el parámetro aplica con los valores actuales (regla `visibleWhen`). */
export function isParamActive(p: ParamDef, params: Record<string, ParamValue>): boolean {
  if (!p.visibleWhen) return true;
  const current = params[p.visibleWhen.param] ?? null;
  const expected = p.visibleWhen.equals;
  return Array.isArray(expected) ? expected.includes(current) : current === expected;
}

/** Valida los parámetros de un elemento contra su definición. */
export function validateParams(
  def: ElementTypeDefinition,
  params: Record<string, ParamValue>,
  resolveOptions?: OptionsResolver,
): ParamIssue[] {
  const issues: ParamIssue[] = [];
  const known = new Set(def.params.map((p) => p.key));

  for (const key of Object.keys(params)) {
    if (!known.has(key)) {
      issues.push({ key, severity: "warning", message: `Parámetro desconocido para ${def.type}; se ignorará.` });
    }
  }

  for (const p of def.params) {
    if (!isParamActive(p, params)) continue;
    const v = params[p.key] ?? null;

    if (v === null || v === "") {
      if (p.required) issues.push({ key: p.key, severity: "error", message: `${p.label}: dato obligatorio.` });
      continue;
    }

    switch (p.kind) {
      case "number": {
        if (typeof v !== "number" || !Number.isFinite(v)) {
          issues.push({ key: p.key, severity: "error", message: `${p.label}: debe ser un número.` });
          break;
        }
        if (p.integer && !Number.isInteger(v)) {
          issues.push({ key: p.key, severity: "error", message: `${p.label}: debe ser un número entero.` });
        }
        if (p.min !== undefined && (p.minExclusive ? v <= p.min : v < p.min)) {
          issues.push({
            key: p.key,
            severity: "error",
            message: `${p.label}: debe ser ${p.minExclusive ? "mayor que" : "al menos"} ${p.min}.`,
          });
        }
        if (p.max !== undefined && v > p.max) {
          issues.push({ key: p.key, severity: "error", message: `${p.label}: no debe exceder ${p.max}.` });
        }
        break;
      }
      case "enum": {
        if (typeof v !== "string") {
          issues.push({ key: p.key, severity: "error", message: `${p.label}: valor no válido.` });
          break;
        }
        const allowed = Array.isArray(p.options)
          ? p.options.map((o) => o.value)
          : resolveOptions?.(p.options.provider, params);
        if (allowed && !allowed.includes(v)) {
          issues.push({ key: p.key, severity: "error", message: `${p.label}: opción "${v}" no permitida.` });
        }
        break;
      }
      case "boolean":
        if (typeof v !== "boolean") {
          issues.push({ key: p.key, severity: "error", message: `${p.label}: debe ser sí/no.` });
        }
        break;
      case "string":
        if (typeof v !== "string") {
          issues.push({ key: p.key, severity: "error", message: `${p.label}: debe ser texto.` });
        }
        break;
    }
  }
  return issues;
}
