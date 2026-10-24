import type { ElementCategory, ElementTypeDefinition } from "./definition";
import { paramDefault, validateParams } from "./params";

/**
 * Catálogo de tipos de elemento disponibles. La aplicación crea uno con la biblioteca
 * estándar (`createDefaultRegistry`) y puede registrar tipos adicionales.
 */
export class ElementRegistry {
  private readonly defs = new Map<string, ElementTypeDefinition>();

  register(def: ElementTypeDefinition): this {
    if (this.defs.has(def.type)) {
      throw new Error(`El tipo de elemento "${def.type}" ya está registrado.`);
    }
    assertWellFormed(def);
    this.defs.set(def.type, def);
    return this;
  }

  has(type: string): boolean {
    return this.defs.has(type);
  }

  get(type: string): ElementTypeDefinition {
    const def = this.defs.get(type);
    if (!def) throw new Error(`Tipo de elemento desconocido: "${type}".`);
    return def;
  }

  tryGet(type: string): ElementTypeDefinition | undefined {
    return this.defs.get(type);
  }

  list(): ElementTypeDefinition[] {
    return [...this.defs.values()];
  }

  byCategory(category: ElementCategory): ElementTypeDefinition[] {
    return this.list().filter((d) => d.category === category);
  }
}

/** Detecta errores de autoría en una definición antes de aceptarla. */
function assertWellFormed(def: ElementTypeDefinition): void {
  const where = `Definición "${def.type}"`;
  if (!/^[a-z][a-z0-9-]*$/.test(def.type)) {
    throw new Error(`${where}: el identificador debe ser kebab-case en minúsculas.`);
  }
  if (def.ports.length === 0) throw new Error(`${where}: necesita al menos un puerto.`);

  const portIds = new Set<string>();
  for (const port of def.ports) {
    if (portIds.has(port.id)) throw new Error(`${where}: puerto duplicado "${port.id}".`);
    portIds.add(port.id);
  }

  const keys = new Set<string>();
  for (const p of def.params) {
    if (keys.has(p.key)) throw new Error(`${where}: parámetro duplicado "${p.key}".`);
    keys.add(p.key);
  }
  for (const p of def.params) {
    if (p.visibleWhen && !keys.has(p.visibleWhen.param)) {
      throw new Error(`${where}: "${p.key}" depende de un parámetro inexistente "${p.visibleWhen.param}".`);
    }
  }

  // Los valores por defecto deben pasar su propia validación (sin contar obligatorios vacíos).
  const defaults = Object.fromEntries(def.params.map((p) => [p.key, paramDefault(p)]));
  const bad = validateParams(def, defaults).filter((i) => i.severity === "error" && defaults[i.key] !== null);
  if (bad.length > 0) {
    throw new Error(`${where}: valores por defecto inválidos: ${bad.map((i) => i.message).join(" ")}`);
  }

  if (!def.tag.prefix) throw new Error(`${where}: falta el prefijo de etiqueta.`);
  if (!def.symbols.ANSI || !def.symbols.IEC) throw new Error(`${where}: faltan símbolos ANSI/IEC.`);
  if (!def.calcBehavior) throw new Error(`${where}: falta el comportamiento de cálculo.`);
}
