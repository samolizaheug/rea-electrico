/**
 * Unidades de presentación. El modelo guarda siempre metros y la designación de calibre de la
 * norma (AWG/kcmil en NOM/NEC, mm² en IEC); aquí solo se convierte para mostrar y capturar.
 */
export interface DisplayUnits {
  conductorSize: "mm2" | "AWG";
  length: "m" | "ft";
}

export const DEFAULT_UNITS: DisplayUnits = { conductorSize: "mm2", length: "m" };

/** 1 ft = 0.3048 m (definición exacta). */
export const M_PER_FT = 0.3048;

export const lengthUnit = (u: DisplayUnits) => u.length;
export const toDisplayLength = (m: number, u: DisplayUnits) => (u.length === "ft" ? m / M_PER_FT : m);
export const fromDisplayLength = (v: number, u: DisplayUnits) => (u.length === "ft" ? v * M_PER_FT : v);

// ---------------------------------------------------------------- Calibres

/** Área de un calibre AWG: d = 0.127 mm · 92^((36 − n)/39); "1/0" = 0, "2/0" = −1… (ASTM B258). */
function awgAreaMm2(gauge: number): number {
  const d = 0.127 * Math.pow(92, (36 - gauge) / 39);
  return (Math.PI / 4) * d * d;
}
/** 1 kcmil = 1000 · (π/4) · (0.0254 mm)² = 0.506707 mm². */
const KCMIL_MM2 = (Math.PI / 4) * 0.0254 * 0.0254 * 1000;

const AWG_SERIES: { label: string; area: number }[] = [
  ...[18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1].map((n) => ({ label: `${n} AWG`, area: awgAreaMm2(n) })),
  ...[0, -1, -2, -3].map((n) => ({ label: `${1 - n}/0 AWG`, area: awgAreaMm2(n) })),
  ...[250, 300, 350, 400, 500, 600, 700, 750, 800, 900, 1000, 1250, 1500, 1750, 2000].map((k) => ({ label: `${k} kcmil`, area: k * KCMIL_MM2 })),
];

/** Calibre AWG/kcmil de área más cercana (en escala logarítmica). */
export function nearestAwg(areaMm2: number): string | undefined {
  if (!(areaMm2 > 0)) return undefined;
  let best = AWG_SERIES[0]!;
  for (const s of AWG_SERIES) if (Math.abs(Math.log(s.area / areaMm2)) < Math.abs(Math.log(best.area / areaMm2))) best = s;
  return best.label;
}

const fmtArea = (a: number) => (a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2));

/**
 * Texto de un calibre en la designación de la norma, con su equivalente si la preferencia del
 * proyecto es el otro sistema: "2/0 AWG (67.4 mm²)" o "25 mm² (≈ 4 AWG)".
 */
export function sizeText(designation: string, system: string, areaMm2: number | undefined, u: DisplayUnits = DEFAULT_UNITS): string {
  if (designation === "—" || !designation) return "—";
  if (system === "mm2") {
    const base = `${designation} mm²`;
    if (u.conductorSize !== "AWG") return base;
    const eq = nearestAwg(areaMm2 ?? Number(designation));
    return eq ? `${base} (≈ ${eq})` : base;
  }
  const base = `${designation} ${system === "kcmil" ? "kcmil" : system === "AWG" ? "AWG" : system}`.trim();
  return u.conductorSize === "mm2" && areaMm2 ? `${base} (${fmtArea(areaMm2)} mm²)` : base;
}
