/**
 * @rea/symbols — símbolos ANSI e IEC como geometría, con utilidades de rotación y
 * serialización a SVG (la usan el editor y la exportación del unifilar).
 */
import type { ElementTypeDefinition } from "@rea/core";
import { symbolLibrary } from "./library";
import type { Anchor, Primitive, Rotation, Side, SymbolDef } from "./types";

export * from "./types";
export { symbolLibrary } from "./library";
export * from "./diagram";

const byKey = new Map(symbolLibrary.map((s) => [s.key, s]));

export function getSymbol(key: string): SymbolDef {
  const s = byKey.get(key);
  if (!s) throw new Error(`Símbolo no definido: "${key}".`);
  return s;
}

/** Símbolo de un tipo de elemento en la simbología del proyecto. */
export function symbolFor(def: ElementTypeDefinition, symbology: "ANSI" | "IEC"): SymbolDef {
  return getSymbol(def.symbols[symbology]);
}

// ---------------------------------------------------------------- Rotación (horaria, múltiplos de 90°)

export function rotatedSize(s: SymbolDef, r: Rotation): { width: number; height: number } {
  return r === 90 || r === 270 ? { width: s.height, height: s.width } : { width: s.width, height: s.height };
}

export function rotatePoint(x: number, y: number, w: number, h: number, r: Rotation): { x: number; y: number } {
  switch (r) {
    case 0:
      return { x, y };
    case 90:
      return { x: h - y, y: x };
    case 180:
      return { x: w - x, y: h - y };
    case 270:
      return { x: y, y: w - x };
  }
}

const SIDES: Side[] = ["top", "right", "bottom", "left"];
export function rotateSide(side: Side, r: Rotation): Side {
  return SIDES[(SIDES.indexOf(side) + r / 90) % 4]!;
}

/** Puntos de conexión del símbolo ya rotado, en coordenadas locales del nodo. */
export function rotatedAnchors(s: SymbolDef, r: Rotation): Record<string, Anchor[]> {
  const out: Record<string, Anchor[]> = {};
  for (const [port, anchors] of Object.entries(s.ports)) {
    out[port] = anchors.map((a) => ({ ...rotatePoint(a.x, a.y, s.width, s.height, r), side: rotateSide(a.side, r) }));
  }
  return out;
}

/** Transformación SVG que rota el símbolo dentro de su caja rotada. */
export function rotationTransform(s: SymbolDef, r: Rotation): string {
  switch (r) {
    case 0:
      return "";
    case 90:
      return `translate(${s.height} 0) rotate(90)`;
    case 180:
      return `translate(${s.width} ${s.height}) rotate(180)`;
    case 270:
      return `translate(0 ${s.width}) rotate(270)`;
  }
}

// ---------------------------------------------------------------- Serialización SVG

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * `textCounterRotation`: grados con que se gira el símbolo; los textos se contrarrotan alrededor
 * de su punto para que sigan leyéndose horizontales.
 */
export function primitiveToSvg(p: Primitive, strokeWidth = 2, textCounterRotation = 0): string {
  const fill = (f?: boolean) => (f ? "currentColor" : "none");
  switch (p.k) {
    case "line":
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="currentColor" stroke-width="${p.w ?? strokeWidth}" stroke-linecap="square"/>`;
    case "circle":
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" stroke="currentColor" stroke-width="${strokeWidth}" fill="${fill(p.fill)}"/>`;
    case "rect":
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" stroke="currentColor" stroke-width="${strokeWidth}" fill="${fill(p.fill)}"/>`;
    case "path":
      return `<path d="${p.d}" stroke="currentColor" stroke-width="${strokeWidth}" fill="${fill(p.fill)}" stroke-linejoin="round"/>`;
    case "text":
      return `<text x="${p.x}" y="${p.y}"${textCounterRotation ? ` transform="rotate(${-textCounterRotation} ${p.x} ${p.y})"` : ""} font-size="${p.size}" font-weight="${p.weight ?? "bold"}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle" dominant-baseline="central" fill="currentColor">${esc(p.text)}</text>`;
  }
}

/** Primitivas del símbolo como SVG (sin la transformación de rotación). */
export function symbolBody(s: SymbolDef, r: Rotation = 0, strokeWidth = 2): string {
  return s.shapes.map((p) => primitiveToSvg(p, strokeWidth, r)).join("");
}

/** SVG completo de un símbolo (útil para íconos de la paleta, pruebas y exportación). */
export function symbolToSvg(s: SymbolDef, r: Rotation = 0, strokeWidth = 2): string {
  const { width, height } = rotatedSize(s, r);
  const body = symbolBody(s, r, strokeWidth);
  const t = rotationTransform(s, r);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">${t ? `<g transform="${t}">${body}</g>` : body}</svg>`;
}
