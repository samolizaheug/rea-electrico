/**
 * Exporta los proyectos de ejemplo como archivos .rea.json para abrirlos en el editor.
 * Uso: pnpm --filter @rea/ejemplos exportar
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serializeProject } from "@rea/core";
import { sistemaEjemplo } from "../src";

const dir = fileURLToPath(new URL("../../../examples/", import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}sistema-ejemplo.rea.json`, serializeProject(sistemaEjemplo()), "utf8");
console.log(`Ejemplo exportado en ${dir}sistema-ejemplo.rea.json`);
