/**
 * Exporta los proyectos de ejemplo como archivos .rea.json para abrirlos en el editor.
 * Uso: pnpm --filter @rea/ejemplos exportar
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serializeProject } from "@rea/core";
import { EJEMPLOS } from "../src";

const dir = fileURLToPath(new URL("../../../examples/", import.meta.url));
mkdirSync(dir, { recursive: true });
for (const e of EJEMPLOS) {
  writeFileSync(`${dir}${e.id}.rea.json`, serializeProject(e.build()), "utf8");
  console.log(`Ejemplo exportado en ${dir}${e.id}.rea.json`);
}
