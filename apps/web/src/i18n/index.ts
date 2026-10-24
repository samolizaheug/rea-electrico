import { es, type Messages } from "./es";

/**
 * Textos de la interfaz. Hoy solo español; para agregar inglés se crea `en.ts` con las mismas
 * claves y se selecciona según `project.settings.language` (etapa E10).
 */
const catalogs: Record<string, Messages> = { es };
let current: Messages = es;

export function setLanguage(lang: string): void {
  current = catalogs[lang] ?? es;
}

/** Traduce una clave e interpola `{nombre}` con los valores dados. */
export function t(key: keyof Messages, vars: Record<string, string | number> = {}): string {
  return current[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
