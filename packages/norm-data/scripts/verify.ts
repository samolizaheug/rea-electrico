/**
 * Registra la revisión humana de una o varias tablas en data/<conjunto>/verificacion.json.
 *
 * Uso (desde la raíz):
 *   pnpm norm:verificar nom-001-sede-2012 tabla-310-15-b-16 --por "Ing. Nombre" [--estado verificado] [--notas "..."]
 *   pnpm norm:verificar nom-001-sede-2012 --todas --por "Ing. Nombre"
 *   pnpm norm:verificar nom-001-sede-2012 tabla-310-15-b-16 --quitar
 *
 * La verificación guarda la huella de los datos: si la tabla se regenera con valores distintos,
 * la verificación deja de valer automáticamente.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fingerprint } from "../src/fingerprint";
import { normTableSchema, verificationFileSchema, verificationStatusSchema } from "../src/schema";
import { writeCatalogAndReport } from "./catalog-writer";
import { DATA_DIR } from "./sources";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dataset = args[0];
if (!dataset) throw new Error("Indica el conjunto de datos, p. ej. nom-001-sede-2012.");
const dir = `${DATA_DIR}${dataset}/`;
const all = args.includes("--todas");
const remove = args.includes("--quitar");
const ids = all
  ? readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "verificacion.json").map((f) => f.replace(/\.json$/, ""))
  : args.slice(1).filter((a, i, arr) => !a.startsWith("--") && !arr[i - 1]?.startsWith("--"));
if (ids.length === 0) throw new Error("Indica el id de la tabla o --todas.");

const vPath = `${dir}verificacion.json`;
const verification = verificationFileSchema.parse(JSON.parse(readFileSync(vPath, "utf8")));
const by = flag("--por");
const status = verificationStatusSchema.parse(flag("--estado") ?? "verificado");
const notes = flag("--notas");
if (!remove && !by) throw new Error('Indica quién verifica con --por "Nombre".');

for (const id of ids) {
  const table = normTableSchema.parse(JSON.parse(readFileSync(`${dir}${id}.json`, "utf8")));
  if (remove) {
    delete verification.tables[id];
    console.log(`– ${id}: verificación eliminada`);
    continue;
  }
  verification.tables[id] = {
    status,
    fingerprint: fingerprint(table.data),
    by: by!,
    date: new Date().toISOString().slice(0, 10),
    ...(notes ? { notes } : {}),
  };
  console.log(`✓ ${id}: ${status} (${by})`);
}
writeFileSync(vPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
writeCatalogAndReport();
