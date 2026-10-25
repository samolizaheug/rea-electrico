/**
 * Coteja, celda por celda, las tablas NOM-001-SEDE-2012 del proyecto contra una segunda
 * extracción independiente del mismo PDF del DOF (fuentes/nom-001-sede-2012-externa/).
 * Dos extracciones hechas por separado que coinciden son una verificación fuerte; cada
 * diferencia se revisa contra la imagen de la página.
 *
 * Uso: pnpm tsx packages/norm-data/scripts/cotejar-nom-externa.ts
 */
import { compararConExterna } from "../src/cotejo-externo";

const r = compararConExterna();
let total = 0;
let iguales = 0;
for (const t of r) {
  total += t.compared;
  iguales += t.compared - t.diffs.length;
  console.log(`${t.diffs.length ? "✗" : "✓"} ${t.ours.padEnd(22)} ↔ ${t.theirs.padEnd(40)} ${t.compared - t.diffs.length}/${t.compared}`);
  for (const d of t.diffs) console.log(`    ${d}`);
}
console.log(`\nCeldas comparadas: ${total} · iguales: ${iguales} · diferentes: ${total - iguales}`);
