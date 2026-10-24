import type { NormTable } from "./schema";

/**
 * Revisiones de consistencia interna de las tablas. No deciden qué valor es correcto:
 * solo señalan valores que rompen el patrón de la propia tabla (monotonía, proporcionalidad),
 * para que el usuario los revise contra el documento fuente.
 */
export interface Anomaly {
  tableId: string;
  where: string;
  message: string;
}

function monotonic(values: (number | null)[], increasing: boolean): number[] {
  const bad: number[] = [];
  let last: number | null = null;
  values.forEach((v, i) => {
    if (v === null) return;
    if (last !== null && (increasing ? v < last : v > last)) bad.push(i);
    last = v;
  });
  return bad;
}

export function findAnomalies(t: NormTable): Anomaly[] {
  const out: Anomaly[] = [];
  const add = (where: string, message: string) => out.push({ tableId: t.id, where, message });

  switch (t.kind) {
    case "ampacity":
      for (const mat of ["cu", "al"] as const) {
        t.data.temperaturesC.forEach((c, j) => {
          for (const i of monotonic(t.data.rows.map((r) => r[mat][j] ?? null), true)) {
            add(`${t.data.rows[i]!.designation} ${mat} ${c} °C`, "La ampacidad disminuye al aumentar el calibre.");
          }
        });
      }
      for (const r of t.data.rows) {
        for (const mat of ["cu", "al"] as const) {
          if (monotonic(r[mat], true).length) add(`${r.designation} ${mat}`, "La ampacidad no crece con la temperatura del conductor.");
        }
      }
      break;
    case "temperature-correction":
      t.data.temperaturesC.forEach((c, j) => {
        for (const i of monotonic(t.data.rows.map((r) => r.factors[j] ?? null), false)) {
          add(`${t.data.rows[i]!.ambientToC} °C / ${c} °C`, "El factor aumenta con la temperatura ambiente.");
        }
      });
      for (let i = 1; i < t.data.rows.length; i++) {
        const prev = t.data.rows[i - 1]!;
        const cur = t.data.rows[i]!;
        if (cur.ambientFromC !== prev.ambientToC + 1) add(`renglón ${i}`, `Intervalo no contiguo: ${prev.ambientToC} → ${cur.ambientFromC}.`);
      }
      break;
    case "egc-size":
      for (const i of monotonic(t.data.rows.map((r) => r.cu.areaMm2), true)) add(`${t.data.rows[i]!.maxRatingA} A Cu`, "El calibre disminuye al aumentar la protección.");
      for (const i of monotonic(t.data.rows.map((r) => r.al?.areaMm2 ?? null), true)) add(`${t.data.rows[i]!.maxRatingA} A Al`, "El calibre disminuye al aumentar la protección.");
      break;
    case "motor-flc":
      for (const g of t.data.groups) {
        g.voltagesV.forEach((v, j) => {
          for (const i of monotonic(t.data.rows.map((r) => r.currentsA[g.id]?.[j] ?? null), true)) {
            add(`${t.data.rows[i]!.hp} hp, ${g.id} ${v} V`, "La corriente disminuye al aumentar la potencia.");
          }
        });
        // Proporcionalidad I·V dentro del renglón (misma potencia): se compara contra la mediana.
        for (const r of t.data.rows) {
          const iv = g.voltagesV
            .map((v, j) => ({ v, p: (r.currentsA[g.id]?.[j] ?? NaN) * v }))
            .filter((x) => Number.isFinite(x.p));
          if (iv.length < 3) continue;
          const sorted = [...iv].map((x) => x.p).sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)]!;
          for (const x of iv) {
            if (Math.abs(x.p / median - 1) > 0.12) {
              add(`${r.hp} hp, ${g.id} ${x.v} V`, `I·V se aparta ${(100 * (x.p / median - 1)).toFixed(0)} % de la mediana del renglón.`);
            }
          }
        }
      }
      break;
    case "conductor-properties": {
      for (const r of t.data.rows) {
        const k = r.dcResistanceOhmPerKm.cu * (r.areaMm2 ?? NaN);
        // ρCu a 75 °C ≈ 0.0210 Ω·mm²/m → R·A ≈ 21 Ω·mm²/km (cableado ligeramente mayor).
        if (!(k > 19.5 && k < 23)) add(`${r.designation} (${r.strands} hilos)`, `R·A = ${k.toFixed(2)} Ω·mm²/km fuera del rango esperado para cobre.`);
      }
      break;
    }
    case "ac-impedance": {
      const sin = Math.sqrt(1 - 0.85 ** 2);
      for (const r of t.data.rows) {
        for (const [conduit, x] of [["pvc", r.xlOhmPerKm.pvcOAluminio], ["aluminio", r.xlOhmPerKm.pvcOAluminio], ["acero", r.xlOhmPerKm.acero]] as const) {
          for (const [mat, R, Z] of [["Cu", r.rCuOhmPerKm[conduit], r.zCuOhmPerKm[conduit]], ["Al", r.rAlOhmPerKm[conduit], r.zAlOhmPerKm[conduit]]] as const) {
            if (R === null || Z === null) continue;
            const ze = R * 0.85 + x * sin;
            if (Math.abs(Z - ze) > Math.max(0.03, 0.06 * ze)) {
              add(`${r.designation} ${mat} ${conduit}`, `Z publicada ${Z} vs R·0.85 + X·0.527 = ${ze.toFixed(3)} Ω/km.`);
            }
          }
        }
      }
      for (const key of ["rCuOhmPerKm", "rAlOhmPerKm"] as const) {
        for (const c of ["pvc", "aluminio", "acero"] as const) {
          for (const i of monotonic(t.data.rows.map((r) => r[key][c]), false)) add(`${t.data.rows[i]!.designation} ${key} ${c}`, "La resistencia aumenta con el calibre.");
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}
