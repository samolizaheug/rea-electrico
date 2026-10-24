import type { TagStyle } from "../registry/definition";

/** Convierte 1 → A, 26 → Z, 27 → AA (numeración tipo columna de hoja de cálculo). */
export function indexToLetters(n: number): string {
  let s = "";
  let k = n;
  while (k > 0) {
    const r = (k - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    k = Math.floor((k - 1) / 26);
  }
  return s;
}

export function lettersToIndex(s: string): number {
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function formatTag(prefix: string, style: TagStyle, index: number): string {
  switch (style) {
    case "number":
      return `${prefix}-${index}`;
    case "number2":
      return `${prefix}-${String(index).padStart(2, "0")}`;
    case "letter":
      return `${prefix}-${indexToLetters(index)}`;
  }
}

/** Devuelve el consecutivo de una etiqueta con ese prefijo y estilo, o null si no corresponde. */
export function parseTagIndex(tag: string, prefix: string, style: TagStyle): number | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = style === "letter" ? `^${escaped}-([A-Z]+)$` : `^${escaped}-(\\d+)$`;
  const m = new RegExp(pattern).exec(tag);
  if (!m?.[1]) return null;
  return style === "letter" ? lettersToIndex(m[1]) : Number.parseInt(m[1], 10);
}

/** Primera etiqueta libre (el menor consecutivo no usado) para el prefijo y estilo dados. */
export function nextFreeTag(existingTags: Iterable<string>, prefix: string, style: TagStyle): string {
  const used = new Set<number>();
  const all = new Set<string>();
  for (const t of existingTags) {
    all.add(t);
    const i = parseTagIndex(t, prefix, style);
    if (i !== null) used.add(i);
  }
  let i = 1;
  while (used.has(i) || all.has(formatTag(prefix, style, i))) i++;
  return formatTag(prefix, style, i);
}
