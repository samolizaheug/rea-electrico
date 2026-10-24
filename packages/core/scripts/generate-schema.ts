/**
 * Genera el JSON Schema del formato de proyecto a partir del esquema zod.
 * Uso: pnpm schema  →  docs/formato-proyecto.schema.json
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { projectSchema } from "../src/model/schema";

const out = fileURLToPath(new URL("../../../docs/formato-proyecto.schema.json", import.meta.url));
const schema = zodToJsonSchema(projectSchema, { name: "Proyecto", $refStrategy: "none" });
writeFileSync(out, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
console.log(`JSON Schema escrito en ${out}`);
