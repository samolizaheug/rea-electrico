/**
 * Extrae la capa de texto de un PDF normativo a un .txt con marcas de página.
 * Uso: pnpm --filter @rea/norm-data extract:nom-2012
 *
 * Cada renglón se reconstruye agrupando fragmentos por coordenada vertical; las columnas
 * se separan con " | " cuando el hueco horizontal es grande. El resultado se guarda en
 * referencias/normas/_texto/ (no versionado) y es la entrada de los constructores de tablas.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { SOURCES, TEXT_DIR, assertSourceHash, sourcePdfPath, textPath, type SourceId } from "./sources";

const id = process.argv[2] as SourceId;
if (!(id in SOURCES)) throw new Error(`Fuente desconocida "${id}". Opciones: ${Object.keys(SOURCES).join(", ")}`);
assertSourceHash(id);

interface Item {
  s: string;
  x: number;
  y: number;
  w: number;
}

const doc = await getDocument({ data: new Uint8Array(readFileSync(sourcePdfPath(id))), useSystemFonts: true }).promise;
const out: string[] = [`PAGES ${doc.numPages}`];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const items: Item[] = [];
  for (const it of content.items) {
    if (!("str" in it) || !it.str.trim()) continue;
    items.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
  }
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: Item[] }[] = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) < 2.5) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  out.push("", `===== PAGE ${p} =====`);
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    let txt = "";
    let endX: number | null = null;
    for (const it of line.items) {
      if (endX !== null) txt += it.x - endX > 8 ? " | " : it.x - endX > 1 ? " " : "";
      txt += it.s;
      endX = it.x + it.w;
    }
    out.push(txt);
  }
  page.cleanup();
}
mkdirSync(TEXT_DIR, { recursive: true });
writeFileSync(textPath(id), `${out.join("\n")}\n`, "utf8");
console.log(`${doc.numPages} páginas → ${textPath(id)}`);
