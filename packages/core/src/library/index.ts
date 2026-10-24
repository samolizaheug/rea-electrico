import { ElementRegistry } from "../registry/registry";
import { distributionTypes } from "./distribution";
import { loadTypes } from "./loads";
import { sourceTypes } from "./sources";
import { transformationTypes } from "./transformation";

export * from "./common";
export * from "./distribution";
export * from "./loads";
export * from "./sources";
export * from "./transformation";

/** Biblioteca estándar de la fase 1, en el orden en que aparece en la paleta del editor. */
export const builtInElementTypes = [...sourceTypes, ...transformationTypes, ...distributionTypes, ...loadTypes];

/** Registro con todos los tipos de la biblioteca estándar. */
export function createDefaultRegistry(): ElementRegistry {
  const registry = new ElementRegistry();
  for (const def of builtInElementTypes) registry.register(def);
  return registry;
}
