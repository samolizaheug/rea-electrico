import type { EnumOption, ParamDef } from "@rea/core";
import { en } from "./en";
import { es, type Messages } from "./es";
import { libraryEn } from "./library-en";

/**
 * Textos de la interfaz en español e inglés, según `project.settings.language`.
 * La biblioteca de elementos (en @rea/core) está en español y se traduce por su texto original.
 * Las memorias de cálculo (pasos y referencias) se muestran en el idioma de la norma.
 */
export type Language = "es" | "en";
const catalogs: Record<Language, Messages> = { es, en };
let lang: Language = "es";
let current: Messages = es;

export function setLanguage(l: string): void {
  lang = l === "en" ? "en" : "es";
  current = catalogs[lang];
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export function getLanguage(): Language {
  return lang;
}

/** Traduce una clave e interpola `{nombre}` con los valores dados. */
export function t(key: keyof Messages, vars: Record<string, string | number> = {}): string {
  return (current[key] ?? es[key]).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Texto de la biblioteca (nombre de tipo, etiqueta, opción, grupo o ayuda) en el idioma activo. */
export function lib(text: string): string;
export function lib(text: string | undefined): string | undefined;
export function lib(text: string | undefined): string | undefined {
  if (text === undefined || lang === "es") return text;
  return libraryEn[text] ?? text;
}

export const paramLabel = (p: ParamDef) => lib(p.label);
export const optionLabel = (o: EnumOption) => lib(o.label);
