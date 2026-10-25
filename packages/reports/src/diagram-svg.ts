import type { ElementRegistry, Project } from "@rea/core";
import type { SizingRunResult } from "@rea/engine";
import { nodeGeometry, rotationTransform, symbolBody, wireEnds } from "@rea/symbols";
import { Position, getSmoothStepPath } from "@xyflow/system";
import { fmtDate, resultBadge } from "./data";
import { rs } from "./strings";

/**
 * Unifilar en SVG vectorial, generado a partir del modelo (no es una captura de pantalla).
 * Usa la misma geometría y el mismo trazo de conductores que el editor.
 */
export interface DiagramSvgOptions {
  /** Resultados para mostrar junto a cada símbolo (como "Mostrar resultados" en el editor). */
  results?: SizingRunResult;
  /** Severidad por elemento para colorear símbolos con observaciones. */
  issues?: Map<string, "error" | "warning">;
  /** Agrega el cuadro de datos (cajetín) al pie. Por defecto true. */
  titleBlock?: boolean;
  norm?: { label: string };
  draft?: boolean;
  date?: Date;
  margin?: number;
}

const FONT = "Roboto, Arial, Helvetica, sans-serif";
const COLORS = { ink: "#1a1a1a", result: "#1d5fbf", warning: "#b26b00", error: "#c62828", grid: "#9aa3ad" };
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Ancho aproximado del texto (para calcular los límites del dibujo). */
const textWidth = (t: string, size: number) => t.length * size * 0.58;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const grow = (b: Box, x: number, y: number) => {
  b.x0 = Math.min(b.x0, x);
  b.y0 = Math.min(b.y0, y);
  b.x1 = Math.max(b.x1, x);
  b.y1 = Math.max(b.y1, y);
};

const r1 = (v: number) => Math.round(v * 10) / 10;

export function diagramSvg(project: Project, registry: ElementRegistry, opts: DiagramSvgOptions = {}): string {
  const margin = opts.margin ?? 30;
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const parts: string[] = [];

  // ---- Conductores (debajo de los símbolos, como en el editor).
  for (const c of project.connections) {
    if (!project.diagram.nodes[c.a.elementId] || !project.diagram.nodes[c.b.elementId]) continue;
    const { a, b } = wireEnds(project, registry, c);
    const [path] = getSmoothStepPath({
      sourceX: a.x,
      sourceY: a.y,
      sourcePosition: a.side as Position,
      targetX: b.x,
      targetY: b.y,
      targetPosition: b.side as Position,
      borderRadius: 0,
      offset: 10,
    });
    const nums = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) grow(box, nums[i]!, nums[i + 1]!);
    parts.push(`<path d="${path}" fill="none" stroke="${COLORS.ink}" stroke-width="1.5"/>`);
  }

  // ---- Símbolos, etiquetas y resultados.
  for (const el of project.elements) {
    const n = project.diagram.nodes[el.id];
    const g = nodeGeometry(project, registry, el.id);
    if (!n || !g) continue;
    const issue = opts.issues?.get(el.id);
    const color = issue === "error" ? COLORS.error : COLORS.ink;
    const body = symbolBody(g.symbol, g.rotation);
    const t = rotationTransform(g.symbol, g.rotation);
    grow(box, n.x, n.y);
    grow(box, n.x + g.width, n.y + g.height);

    const lines: { text: string; size: number; weight: number; fill: string }[] = [{ text: el.tag, size: 11, weight: 700, fill: COLORS.ink }];
    if (opts.results) {
      const fill = issue === "error" ? COLORS.error : issue === "warning" ? COLORS.warning : COLORS.result;
      for (const l of resultBadge(el.id, el.type, opts.results)) lines.push({ text: l, size: 10, weight: 400, fill });
    }
    const lh = (s: number) => s + 2;
    const blockH = lines.reduce((s, l) => s + lh(l.size), 0);
    const onSide = g.width <= 60 && (g.rotation === 0 || g.rotation === 180);
    const lx = onSide ? g.width + 6 : 0;
    let ly = onSide ? g.height / 2 - blockH / 2 : -2 - blockH;
    const texts = lines.map((l) => {
      const y = ly + l.size;
      ly += lh(l.size);
      grow(box, n.x + lx + textWidth(l.text, l.size), n.y + y + 3);
      grow(box, n.x + lx, n.y + y - l.size);
      return `<text x="${r1(lx)}" y="${r1(y)}" font-size="${l.size}" font-weight="${l.weight}" font-family="${FONT}" fill="${l.fill}">${esc(l.text)}</text>`;
    });
    parts.push(
      `<g transform="translate(${n.x} ${n.y})" color="${color}" stroke="none"><g>${t ? `<g transform="${t}">${body}</g>` : body}</g>${texts.join("")}</g>`,
    );
  }

  if (!Number.isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 400, y1: 300 });
  const drawW = box.x1 - box.x0;
  const width = Math.max(drawW + 2 * margin, opts.titleBlock === false ? 0 : 720);
  const tbH = opts.titleBlock === false ? 0 : 74 + margin / 2;
  const height = box.y1 - box.y0 + 2 * margin + tbH;
  // Centra el dibujo horizontalmente si el cajetín obliga a un ancho mayor.
  const ox = box.x0 - (width - drawW) / 2;
  const oy = box.y0 - margin;

  const tb = opts.titleBlock === false ? "" : titleBlock(project, opts, ox + margin / 2, oy + height - tbH, width - margin, 74);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r1(width)}" height="${r1(height)}" viewBox="${r1(ox)} ${r1(oy)} ${r1(width)} ${r1(height)}">`,
    `<rect x="${r1(ox)}" y="${r1(oy)}" width="${r1(width)}" height="${r1(height)}" fill="#ffffff"/>`,
    ...parts,
    tb,
    `</svg>`,
  ].join("");
}

/** Cajetín: proyecto, cliente, ubicación, norma, elaboró, fecha. */
function titleBlock(project: Project, opts: DiagramSvgOptions, x: number, y: number, w: number, h: number): string {
  const m = project.meta;
  const pad = 8;
  const top = y + 6;
  const cell = (cx: number, cy: number, label: string, value: string, size = 10, bold = false) =>
    `<text x="${r1(cx + pad)}" y="${r1(cy + 12)}" font-size="7.5" font-family="${FONT}" fill="${COLORS.grid}">${esc(label.toUpperCase())}</text>` +
    `<text x="${r1(cx + pad)}" y="${r1(cy + 14 + size)}" font-size="${size}" font-weight="${bold ? 700 : 400}" font-family="${FONT}" fill="${COLORS.ink}">${esc(value || "—")}</text>`;
  const c1 = w * 0.4;
  const c2 = w * 0.25;
  const c3 = w * 0.2;
  const rowH = (h - 6) / 2;
  const xs = [x, x + c1, x + c1 + c2, x + c1 + c2 + c3, x + w];
  const lines = [
    `<rect x="${r1(x)}" y="${r1(top)}" width="${r1(w)}" height="${r1(h - 6)}" fill="none" stroke="${COLORS.ink}" stroke-width="1"/>`,
    ...xs.slice(1, -1).map((xx) => `<line x1="${r1(xx)}" y1="${r1(top)}" x2="${r1(xx)}" y2="${r1(top + h - 6)}" stroke="${COLORS.ink}" stroke-width="0.6"/>`),
    `<line x1="${r1(xs[1]!)}" y1="${r1(top + rowH)}" x2="${r1(x + w)}" y2="${r1(top + rowH)}" stroke="${COLORS.ink}" stroke-width="0.6"/>`,
  ];
  const date = fmtDate(opts.date ?? new Date());
  return [
    ...lines,
    cell(xs[0]!, top, rs("diagramTitle"), m.name, 13, true),
    `<text x="${r1(xs[0]! + pad)}" y="${r1(top + 46)}" font-size="9" font-family="${FONT}" fill="${COLORS.ink}">${esc([m.client, m.location].filter(Boolean).join(" · "))}</text>`,
    opts.draft ? `<text x="${r1(xs[1]! - pad)}" y="${r1(top + 16)}" text-anchor="end" font-size="10" font-weight="700" font-family="${FONT}" fill="${COLORS.error}">${rs("draft")}</text>` : "",
    cell(xs[1]!, top, rs("norm"), opts.norm?.label ?? project.settings.norm.id),
    cell(xs[2]!, top, rs("symbology"), project.settings.symbology === "ANSI" ? "ANSI / IEEE" : "IEC"),
    cell(xs[3]!, top, rs("frequency"), `${project.settings.frequencyHz} Hz`),
    cell(xs[1]!, top + rowH, rs("author"), m.author),
    cell(xs[2]!, top + rowH, rs("generated"), date),
    cell(xs[3]!, top + rowH, "REA Eléctrico", rs("page", { n: 1, total: 1 })),
  ].join("");
}
