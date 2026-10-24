import { validateParams, type OptionsResolver } from "../registry/params";
import type { ElementRegistry } from "../registry/registry";
import { CURRENT_SCHEMA_VERSION, PROJECT_FORMAT, projectSchema, type Project } from "../model/schema";

export interface ProjectIssue {
  severity: "error" | "warning";
  /** Ruta al dato con problema, p. ej. "elements[3].params.voltageV". */
  path: string;
  message: string;
  elementId?: string;
}

export class ProjectFormatError extends Error {
  constructor(
    message: string,
    readonly issues: ProjectIssue[],
  ) {
    super(message);
  }
}

/** Serializa el proyecto como JSON legible (2 espacios), apto para control de versiones. */
export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

/**
 * Migraciones de esquema: cada entrada lleva un documento de la versión N a la N+1.
 * Hoy solo existe la versión 1; las futuras se agregan aquí sin romper archivos antiguos.
 */
const migrations: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {};

function migrate(doc: Record<string, unknown>): Record<string, unknown> {
  let current = doc;
  let version = typeof current.schemaVersion === "number" ? current.schemaVersion : NaN;
  if (!Number.isInteger(version)) throw new ProjectFormatError("El archivo no indica una versión de esquema válida.", []);
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new ProjectFormatError(
      `El archivo usa la versión de esquema ${version}, más nueva que la soportada (${CURRENT_SCHEMA_VERSION}). Actualiza la aplicación.`,
      [],
    );
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new ProjectFormatError(`No hay migración desde la versión de esquema ${version}.`, []);
    current = step(current);
    version += 1;
  }
  return current;
}

/**
 * Lee un archivo de proyecto: JSON → migración → validación de estructura (zod).
 * Si se pasa el registro, también valida tipos, puertos, conexiones y parámetros.
 */
export function parseProject(
  text: string,
  registry?: ElementRegistry,
  resolveOptions?: OptionsResolver,
): { project: Project; issues: ProjectIssue[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ProjectFormatError(`El archivo no es JSON válido: ${(e as Error).message}`, []);
  }
  if (typeof raw !== "object" || raw === null || (raw as { format?: unknown }).format !== PROJECT_FORMAT) {
    throw new ProjectFormatError(`El archivo no es un proyecto de ${PROJECT_FORMAT}.`, []);
  }

  const parsed = projectSchema.safeParse(migrate(raw as Record<string, unknown>));
  if (!parsed.success) {
    const issues: ProjectIssue[] = parsed.error.issues.map((i) => ({
      severity: "error",
      path: i.path.map((p) => (typeof p === "number" ? `[${p}]` : `.${p}`)).join("").replace(/^\./, ""),
      message: i.message,
    }));
    throw new ProjectFormatError("El archivo de proyecto tiene errores de estructura.", issues);
  }

  const project = parsed.data;
  const issues = registry ? validateProject(project, registry, resolveOptions) : [];
  return { project, issues };
}

/** Validación semántica del modelo (no topológica: esa la hace el validador de red del motor). */
export function validateProject(project: Project, registry: ElementRegistry, resolveOptions?: OptionsResolver): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const byId = new Map(project.elements.map((e) => [e.id, e]));
  const ids = new Set<string>();
  const tags = new Map<string, string>();

  project.elements.forEach((el, i) => {
    const base = `elements[${i}]`;
    if (ids.has(el.id)) issues.push({ severity: "error", path: `${base}.id`, message: `Identificador duplicado "${el.id}".`, elementId: el.id });
    ids.add(el.id);

    const other = tags.get(el.tag);
    if (other) issues.push({ severity: "error", path: `${base}.tag`, message: `Etiqueta duplicada "${el.tag}".`, elementId: el.id });
    tags.set(el.tag, el.id);

    const def = registry.tryGet(el.type);
    if (!def) {
      issues.push({ severity: "error", path: `${base}.type`, message: `Tipo de elemento desconocido "${el.type}".`, elementId: el.id });
      return;
    }
    for (const pi of validateParams(def, el.params, resolveOptions)) {
      issues.push({ severity: pi.severity, path: `${base}.params.${pi.key}`, message: `${el.tag}: ${pi.message}`, elementId: el.id });
    }
    if (!project.diagram.nodes[el.id]) {
      issues.push({ severity: "warning", path: `diagram.nodes.${el.id}`, message: `${el.tag} no tiene posición en el diagrama.`, elementId: el.id });
    }
  });

  const portUse = new Map<string, number>();
  project.connections.forEach((c, i) => {
    for (const [side, ref] of [["a", c.a], ["b", c.b]] as const) {
      const path = `connections[${i}].${side}`;
      const el = byId.get(ref.elementId);
      if (!el) {
        issues.push({ severity: "error", path, message: `La conexión apunta a un elemento inexistente "${ref.elementId}".` });
        continue;
      }
      const port = registry.tryGet(el.type)?.ports.find((p) => p.id === ref.portId);
      if (!port) {
        issues.push({ severity: "error", path, message: `${el.tag} no tiene el puerto "${ref.portId}".`, elementId: el.id });
        continue;
      }
      const key = `${ref.elementId}/${ref.portId}`;
      const used = (portUse.get(key) ?? 0) + 1;
      portUse.set(key, used);
      const max = port.maxConnections === undefined ? 1 : port.maxConnections;
      if (max !== null && used > max) {
        issues.push({ severity: "error", path, message: `El puerto "${port.label}" de ${el.tag} tiene más conexiones de las permitidas.`, elementId: el.id });
      }
    }
  });

  return issues;
}
