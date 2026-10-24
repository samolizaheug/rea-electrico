import type { Anchor, Primitive, SymbolDef } from "./types";

/**
 * Biblioteca de símbolos. Referencias de estilo: IEEE 315 / ANSI Y32.2 (ANSI) e IEC 60617 (IEC).
 * Son representaciones simplificadas para diagramas unifilares; sujetas a revisión del usuario.
 */

const top = (x: number, y = 0): Anchor => ({ x, y, side: "top" });
const bottom = (x: number, y: number): Anchor => ({ x, y, side: "bottom" });
const right = (x: number, y: number): Anchor => ({ x, y, side: "right" });
const line = (x1: number, y1: number, x2: number, y2: number, w?: number): Primitive => ({ k: "line", x1, y1, x2, y2, w });
const text = (x: number, y: number, t: string, size = 12, weight: "normal" | "bold" = "bold"): Primitive => ({ k: "text", x, y, text: t, size, weight });

// ---------------------------------------------------------------- Fuentes

const utilityAnsi: SymbolDef = {
  key: "ansi/utility",
  width: 40,
  height: 60,
  ports: { out: [bottom(20, 60)] },
  shapes: [{ k: "rect", x: 6, y: 4, w: 28, h: 28 }, line(6, 4, 34, 32), line(34, 4, 6, 32), line(20, 32, 20, 60)],
};

const utilityIec: SymbolDef = {
  key: "iec/utility",
  width: 40,
  height: 60,
  ports: { out: [bottom(20, 60)] },
  shapes: [
    { k: "rect", x: 6, y: 4, w: 28, h: 28 },
    line(15.3, 4, 15.3, 32),
    line(24.7, 4, 24.7, 32),
    line(6, 13.3, 34, 13.3),
    line(6, 22.7, 34, 22.7),
    line(20, 32, 20, 60),
  ],
};

const generatorAnsi: SymbolDef = {
  key: "ansi/generator",
  width: 40,
  height: 60,
  ports: { out: [bottom(20, 60)] },
  shapes: [{ k: "circle", cx: 20, cy: 22, r: 15 }, text(20, 22, "G", 14), line(20, 37, 20, 60)],
};

const generatorIec: SymbolDef = {
  key: "iec/generator",
  width: 40,
  height: 60,
  ports: { out: [bottom(20, 60)] },
  shapes: [{ k: "circle", cx: 20, cy: 22, r: 15 }, text(20, 18, "G", 12), text(20, 30, "~", 12), line(20, 37, 20, 60)],
};

const upsAnsi: SymbolDef = {
  key: "ansi/ups",
  width: 40,
  height: 80,
  ports: { in: [top(20)], out: [bottom(20, 80)] },
  shapes: [line(20, 0, 20, 20), { k: "rect", x: 2, y: 20, w: 36, h: 40 }, text(20, 40, "UPS", 10), line(20, 60, 20, 80)],
};

const upsIec: SymbolDef = {
  key: "iec/ups",
  width: 40,
  height: 80,
  ports: { in: [top(20)], out: [bottom(20, 80)] },
  shapes: [
    line(20, 0, 20, 20),
    { k: "rect", x: 2, y: 20, w: 36, h: 40 },
    line(2, 60, 38, 20),
    text(11, 30, "~", 11),
    text(29, 51, "=", 11),
    line(20, 60, 20, 80),
  ],
};

// ---------------------------------------------------------------- Transformación

const coil = (y: number, bumpDown: boolean) => `M8 ${y} a4 4 0 0 ${bumpDown ? 0 : 1} 8 0 a4 4 0 0 ${bumpDown ? 0 : 1} 8 0 a4 4 0 0 ${bumpDown ? 0 : 1} 8 0`;

const transformerAnsi: SymbolDef = {
  key: "ansi/transformer-2w",
  width: 40,
  height: 100,
  ports: { primary: [top(20)], secondary: [bottom(20, 100)] },
  shapes: [
    line(20, 0, 20, 30),
    line(8, 30, 32, 30),
    line(8, 30, 8, 42),
    line(32, 30, 32, 42),
    { k: "path", d: coil(42, true) },
    { k: "path", d: coil(58, false) },
    line(8, 58, 8, 70),
    line(32, 58, 32, 70),
    line(8, 70, 32, 70),
    line(20, 70, 20, 100),
  ],
};

const transformerIec: SymbolDef = {
  key: "iec/transformer-2w",
  width: 40,
  height: 100,
  ports: { primary: [top(20)], secondary: [bottom(20, 100)] },
  shapes: [
    line(20, 0, 20, 24),
    { k: "circle", cx: 20, cy: 40, r: 16 },
    { k: "circle", cx: 20, cy: 60, r: 16 },
    line(20, 76, 20, 100),
  ],
};

// ---------------------------------------------------------------- Distribución

const busPorts = (w: number, h: number) => ({ bus: [top(w / 2), bottom(w / 2, h)] });

// En barras y tableros no se dibujan acometidas fijas: cada conexión se dibuja como una
// derivación perpendicular desde su posición sobre la barra (ver `bus`).
const panelboardAnsi: SymbolDef = {
  key: "ansi/panelboard",
  width: 160,
  height: 40,
  ports: busPorts(160, 40),
  shapes: [line(4, 20, 156, 20, 5)],
  bus: { halfLength: 72, halfThickness: 2 },
};

const panelboardIec: SymbolDef = {
  key: "iec/panelboard",
  width: 160,
  height: 40,
  ports: busPorts(160, 40),
  shapes: [{ k: "rect", x: 4, y: 12, w: 152, h: 16 }],
  bus: { halfLength: 72, halfThickness: 8 },
};

const mccAnsi: SymbolDef = {
  key: "ansi/mcc",
  width: 160,
  height: 40,
  ports: busPorts(160, 40),
  shapes: [{ k: "rect", x: 4, y: 8, w: 152, h: 24 }, line(10, 20, 150, 20, 4), text(140, 14, "CCM", 7)],
  bus: { halfLength: 72, halfThickness: 12 },
};

const mccIec: SymbolDef = {
  key: "iec/mcc",
  width: 160,
  height: 40,
  ports: busPorts(160, 40),
  shapes: [{ k: "rect", x: 4, y: 8, w: 152, h: 24 }, text(80, 20, "CCM", 10)],
  bus: { halfLength: 72, halfThickness: 12 },
};

const busbarSym = (key: string): SymbolDef => ({
  key,
  width: 200,
  height: 20,
  ports: busPorts(200, 20),
  shapes: [line(0, 10, 200, 10, 6)],
  bus: { halfLength: 96, halfThickness: 3 },
});

const breakerAnsi: SymbolDef = {
  key: "ansi/breaker",
  width: 40,
  height: 60,
  ports: { line: [top(20)], load: [bottom(20, 60)] },
  shapes: [line(20, 0, 20, 18), { k: "rect", x: 10, y: 18, w: 20, h: 24 }, line(20, 42, 20, 60)],
};

const breakerIec: SymbolDef = {
  key: "iec/breaker",
  width: 40,
  height: 60,
  ports: { line: [top(20)], load: [bottom(20, 60)] },
  shapes: [
    line(20, 0, 20, 20),
    line(16, 16, 24, 24),
    line(16, 24, 24, 16),
    line(20, 42, 8, 22),
    line(20, 42, 20, 60),
  ],
};

const atsAnsi: SymbolDef = {
  key: "ansi/ats",
  width: 60,
  height: 80,
  ports: { normal: [top(20)], emergency: [right(60, 40)], load: [bottom(20, 80)] },
  shapes: [
    line(20, 0, 20, 20),
    { k: "rect", x: 4, y: 20, w: 44, h: 40 },
    text(26, 40, "ATS", 10),
    line(48, 40, 60, 40),
    line(20, 60, 20, 80),
  ],
};

const atsIec: SymbolDef = {
  key: "iec/ats",
  width: 60,
  height: 80,
  ports: { normal: [top(20)], emergency: [right(60, 40)], load: [bottom(20, 80)] },
  shapes: [
    line(20, 0, 20, 26),
    line(60, 40, 40, 40),
    line(40, 40, 40, 26),
    line(20, 56, 22, 28),
    { k: "circle", cx: 20, cy: 56, r: 2, fill: true },
    line(20, 56, 20, 80),
  ],
};

const cableAnsi: SymbolDef = {
  key: "ansi/cable",
  width: 40,
  height: 80,
  ports: { from: [top(20)], to: [bottom(20, 80)] },
  shapes: [line(20, 0, 20, 80), { k: "path", d: "M13 32 q7 8 14 0" }, { k: "path", d: "M13 48 q7 -8 14 0" }],
};

const cableIec: SymbolDef = {
  key: "iec/cable",
  width: 40,
  height: 80,
  ports: { from: [top(20)], to: [bottom(20, 80)] },
  shapes: [line(20, 0, 20, 80), line(13, 36, 27, 30), line(13, 42, 27, 36), line(13, 48, 27, 42)],
};

// ---------------------------------------------------------------- Cargas

const motorSym = (key: string, iec: boolean): SymbolDef => ({
  key,
  width: 40,
  height: 60,
  ports: { in: [top(20)] },
  shapes: [
    line(20, 0, 20, 20),
    { k: "circle", cx: 20, cy: 38, r: 17 },
    ...(iec ? [text(20, 34, "M", 13), text(20, 47, "~", 11)] : [text(20, 38, "M", 15)]),
  ],
});

const vfdAnsi: SymbolDef = {
  key: "ansi/vfd",
  width: 40,
  height: 80,
  ports: { in: [top(20)], out: [bottom(20, 80)] },
  shapes: [line(20, 0, 20, 20), { k: "rect", x: 2, y: 20, w: 36, h: 40 }, text(20, 40, "VFD", 10), line(20, 60, 20, 80)],
};

const vfdIec: SymbolDef = {
  key: "iec/vfd",
  width: 40,
  height: 80,
  ports: { in: [top(20)], out: [bottom(20, 80)] },
  shapes: [
    line(20, 0, 20, 20),
    { k: "rect", x: 2, y: 20, w: 36, h: 40 },
    line(2, 60, 38, 20),
    text(11, 31, "f1", 9, "normal"),
    text(29, 51, "f2", 9, "normal"),
    line(20, 60, 20, 80),
  ],
};

const receptacleAnsi: SymbolDef = {
  key: "ansi/receptacle",
  width: 40,
  height: 60,
  ports: { in: [top(20)] },
  shapes: [line(20, 0, 20, 24), { k: "circle", cx: 20, cy: 38, r: 14 }, line(15, 32, 15, 44), line(25, 32, 25, 44)],
};

const receptacleIec: SymbolDef = {
  key: "iec/receptacle",
  width: 40,
  height: 60,
  ports: { in: [top(20)] },
  shapes: [line(20, 0, 20, 30), line(6, 30, 34, 30), { k: "path", d: "M8 36 a12 12 0 0 0 24 0" }],
};

const luminaireAnsi: SymbolDef = {
  key: "ansi/luminaire",
  width: 40,
  height: 60,
  ports: { in: [top(20)] },
  shapes: [line(20, 0, 20, 24), { k: "circle", cx: 20, cy: 38, r: 14 }, { k: "circle", cx: 20, cy: 38, r: 5, fill: true }],
};

const luminaireIec: SymbolDef = {
  key: "iec/luminaire",
  width: 40,
  height: 60,
  ports: { in: [top(20)] },
  shapes: [line(20, 0, 20, 24), { k: "circle", cx: 20, cy: 38, r: 14 }, line(10.1, 28.1, 29.9, 47.9), line(29.9, 28.1, 10.1, 47.9)],
};

const genericLoadSym = (key: string): SymbolDef => ({
  key,
  width: 40,
  height: 60,
  ports: { in: [top(20)] },
  shapes: [line(20, 0, 20, 36), { k: "path", d: "M10 36 L30 36 L20 56 Z", fill: true }],
});

const groupedLoadSym = (key: string): SymbolDef => ({
  key,
  width: 80,
  height: 60,
  ports: { in: [top(40)] },
  shapes: [
    line(40, 0, 40, 20),
    line(14, 20, 66, 20),
    ...[14, 40, 66].flatMap((x): Primitive[] => [line(x, 20, x, 40), { k: "path", d: `M${x - 6} 40 L${x + 6} 40 L${x} 54 Z`, fill: true }]),
  ],
});

export const symbolLibrary: SymbolDef[] = [
  utilityAnsi,
  utilityIec,
  generatorAnsi,
  generatorIec,
  upsAnsi,
  upsIec,
  transformerAnsi,
  transformerIec,
  panelboardAnsi,
  panelboardIec,
  mccAnsi,
  mccIec,
  busbarSym("ansi/busbar"),
  busbarSym("iec/busbar"),
  breakerAnsi,
  breakerIec,
  atsAnsi,
  atsIec,
  cableAnsi,
  cableIec,
  motorSym("ansi/motor", false),
  motorSym("iec/motor", true),
  vfdAnsi,
  vfdIec,
  receptacleAnsi,
  receptacleIec,
  luminaireAnsi,
  luminaireIec,
  genericLoadSym("ansi/generic-load"),
  genericLoadSym("iec/generic-load"),
  groupedLoadSym("ansi/grouped-load"),
  groupedLoadSym("iec/grouped-load"),
];
