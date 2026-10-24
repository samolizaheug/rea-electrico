import { readFileSync } from "node:fs";

/** Renglón del texto extraído, con la página del PDF de la que proviene. */
export interface SourceLine {
  text: string;
  page: number;
  /** Número de renglón en el .txt (1-based), útil para depurar. */
  lineNo: number;
}

/** Encabezado y pie del DOF que se repiten en cada página. */
const PAGE_HEADER = /DIARIO OFICIAL/;

export class TextSource {
  readonly lines: SourceLine[] = [];

  constructor(path: string) {
    let page = 0;
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .forEach((text, i) => {
        const m = /^===== PAGE (\d+) =====$/.exec(text);
        if (m) {
          page = Number(m[1]);
          return;
        }
        if (!text.trim() || PAGE_HEADER.test(text) || text.startsWith("PAGES ")) return;
        this.lines.push({ text, page, lineNo: i + 1 });
      });
  }

  /** Índice del renglón que cumple `pattern` (n-ésima aparición, desde 1). */
  find(pattern: RegExp, occurrence = 1, from = 0): number {
    let seen = 0;
    for (let i = from; i < this.lines.length; i++) {
      if (pattern.test(this.lines[i]!.text) && ++seen === occurrence) return i;
    }
    throw new Error(`No se encontró ${pattern} (aparición ${occurrence}).`);
  }

  /** Renglones desde el encabezado (exclusivo) hasta el primer renglón que cumple `end` (exclusivo). */
  section(start: RegExp, end: RegExp, occurrence = 1): SourceLine[] {
    const s = this.find(start, occurrence);
    const e = this.find(end, 1, s + 1);
    return this.lines.slice(s + 1, e);
  }
}

/** Separa un renglón en celdas por " | " y espacios. */
export function cells(line: string): string[] {
  return line
    .split("|")
    .flatMap((c) => c.trim().split(/\s+/))
    .filter((c) => c !== "");
}

/** Número de la tabla publicada; "-" o "––" se convierten en null. */
export function cellValue(token: string): number | null {
  const t = token.replace(/\*+$/, "").trim();
  if (/^[-–—]+$/.test(t)) return null;
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error(`Valor no numérico en tabla: "${token}"`);
  return v;
}

export function pagesOf(lines: SourceLine[]): number[] {
  return [...new Set(lines.map((l) => l.page))].sort((a, b) => a - b);
}

export function expectCount<T>(items: T[], n: number, what: string): T[] {
  if (items.length !== n) throw new Error(`${what}: se esperaban ${n} renglones, se obtuvieron ${items.length}.`);
  return items;
}
