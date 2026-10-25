import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getNormDataset } from "../src";

/**
 * Pruebas de consistencia de las tablas IEC 60364 transcritas de ABB (fuente secundaria).
 * Son independientes de la transcripción: relaciones físicas entre columnas, R y X contra las
 * tablas de caída específica publicadas en la misma fuente y, si el texto del PDF está disponible,
 * presencia de cada valor en la capa de texto de su página.
 */
const ds = getNormDataset("iec-60364", "2001");
const air = ds.table("ampacidad-aire", "iec-ampacity");
const ground = ds.table("ampacidad-terreno", "iec-ampacity");

describe("IEC 60364 (ABB): ampacidades", () => {
  const all = [air, ground];

  it("cada columna crece con la sección", () => {
    for (const t of all)
      for (const c of t.data.columns) {
        const vals = c.values.filter((v): v is number => v !== null);
        expect(vals.length, c.id).toBeGreaterThan(5);
        for (let i = 1; i < vals.length; i++) expect(vals[i]!, `${c.id} #${i}`).toBeGreaterThan(vals[i - 1]!);
      }
  });

  it("Cu ≥ Al, XLPE ≥ PVC y 2 conductores cargados ≥ 3 en la misma condición", () => {
    for (const t of all) {
      const cols = t.data.columns;
      const find = (c: (typeof cols)[number], patch: Partial<(typeof cols)[number]>) =>
        cols.find((x) => x.method === c.method && (patch.material ?? c.material) === x.material && (patch.insulation ?? c.insulation) === x.insulation && (patch.loadedConductors ?? c.loadedConductors) === x.loadedConductors && (patch.arrangement ?? c.arrangement) === x.arrangement);
      const ge = (a: (number | null)[], b: (number | null)[], what: string) => a.forEach((v, i) => v !== null && b[i] !== null && expect(v, `${what} [${t.data.sizesMm2[i]} mm²]`).toBeGreaterThanOrEqual(b[i]!));
      for (const c of cols) {
        if (c.material === "Cu") { const al = find(c, { material: "Al" }); if (al) ge(c.values, al.values, `${c.id} ≥ Al`); }
        if (c.insulation === "XLPE") { const pvc = find(c, { insulation: "PVC" }); if (pvc) ge(c.values, pvc.values, `${c.id} ≥ PVC`); }
        if (c.loadedConductors === 2 && c.method !== "F") { const three = find(c, { loadedConductors: 3 }); if (three) ge(c.values, three.values, `${c.id} ≥ 3`); }
      }
    }
  });

  it("valores de control conocidos (A1, C, D)", () => {
    const v = (t: typeof air, id: string, s: number) => t.data.columns.find((c) => c.id === id)!.values[t.data.sizesMm2.indexOf(s)];
    expect(v(air, "A1-Cu-PVC-2", 2.5)).toBe(19.5);
    expect(v(air, "C-Cu-PVC-2", 25)).toBe(112);
    expect(v(air, "C-Cu-XLPE-3", 25)).toBe(119);
    expect(v(air, "B1-Cu-PVC-3", 150)).toBe(262); // edición 2009
    expect(v(ground, "D-Cu-XLPE-3", 300)).toBe(396);
  });

  it("ABB-2: 15 A, valor de la 4.ª ed. confirmado por la edición 2009 (sin errata)", () => {
    const v = air.data.columns.find((c) => c.id === "A1-Al-PVC-2")!.values[air.data.sizesMm2.indexOf(2.5)];
    expect(v).toBe(15);
    expect(air.errata).toEqual([]);
  });

  it("B1 y B2 de 150 a 300 mm² completados con la edición 2009 (valores de control)", () => {
    const v = (id: string, s: number) => air.data.columns.find((c) => c.id === id)!.values[air.data.sizesMm2.indexOf(s)];
    expect(v("B1-Cu-PVC-2", 150)).toBe(300);
    expect(v("B1-Cu-XLPE-3", 300)).toBe(514);
    expect(v("B2-Al-PVC-3", 240)).toBe(232);
    expect(v("B2-Cu-XLPE-2", 185)).toBe(384);
    expect(v("B1-Cu-PVC-2", 400)).toBeNull();
    expect(air.notes.join(" ")).toContain("2009");
  });
});

describe("IEC 60364 (ABB): tabla aproximada de motores", () => {
  const t = ds.table("anexo-b-tabla-5-motores", "motor-flc");
  it("61 renglones; la corriente crece con la potencia y baja con la tensión", () => {
    expect(t.data.rows).toHaveLength(61);
    const g = t.data.groups[0]!.id;
    for (let j = 0; j < 8; j++) {
      const col = t.data.rows.map((r) => r.currentsA[g]![j]).filter((x): x is number => x !== null);
      for (let i = 1; i < col.length; i++) expect(col[i]!, `col ${j} #${i}`).toBeGreaterThanOrEqual(col[i - 1]!);
    }
    for (const r of t.data.rows) {
      const a = r.currentsA[g]!.filter((x): x is number => x !== null);
      for (let i = 1; i < a.length; i++) expect(a[i]!, `${r.kW} kW`).toBeLessThanOrEqual(a[i - 1]!);
    }
  });
});

describe("IEC 60364 (ABB): R y X contra las tablas de caída específica (cap. 2.2.2, Tablas 3, 4 y 8)", () => {
  // Valores publicados de ΔUx [V/(A·km)] trifásicos; ΔUx = √3 (r cosφ + x senφ).
  const CU_COS1 = {
    single: [25.63, 15.43, 9.65, 6.43, 3.88, 2.44, 1.54, 1.11, 0.82, 0.57, 0.41, 0.33, 0.27, 0.21, 0.16, 0.13],
    multi: [26.15, 15.73, 9.84, 6.55, 3.93, 2.48, 1.57, 1.13, 0.84, 0.58, 0.42, 0.33, 0.27, 0.22, 0.17, 0.14],
  };
  const CU_COS09 = {
    single: [23.2, 14.01, 8.79, 5.89, 3.58, 2.28, 1.47, 1.08, 0.81, 0.58, 0.44, 0.36, 0.31, 0.26, 0.22, 0.19],
    multi: [23.63, 14.24, 8.93, 5.96, 3.6, 2.29, 1.48, 1.08, 0.81, 0.58, 0.43, 0.35, 0.3, 0.25, 0.21, 0.18],
  };
  const AL_COS1 = {
    single: [42.23, 25.43, 15.89, 10.59, 6.39, 4.02, 2.54, 1.83, 1.35, 0.94, 0.67, 0.54, 0.44, 0.35, 0.27, 0.22],
    multi: [43.09, 25.91, 16.21, 10.79, 6.48, 4.08, 2.59, 1.87, 1.38, 0.95, 0.69, 0.55, 0.45, 0.36, 0.28, 0.22],
  };
  const du = (r: number, x: number, cos: number) => Math.sqrt(3) * (r * cos + x * Math.sqrt(1 - cos * cos));
  const check = (id: string, pub: { single: number[]; multi: number[] }, cos: number) => {
    const t = ds.table(id, "cable-impedance");
    t.data.rows.forEach((r, i) => {
      // Valores publicados con 2 decimales: tolerancia de redondeo.
      expect(Math.abs(du(r.singleCore.rOhmPerKm, r.singleCore.xOhmPerKm, cos) - pub.single[i]!), `${id} unipolar ${r.sizeMm2}`).toBeLessThanOrEqual(0.0051);
      expect(Math.abs(du(r.multiCore.rOhmPerKm, r.multiCore.xOhmPerKm, cos) - pub.multi[i]!), `${id} multiconductor ${r.sizeMm2}`).toBeLessThanOrEqual(0.0051);
    });
  };
  it("cobre, cosφ = 1 (solo R)", () => check("tabla-1-impedancia-cu", CU_COS1, 1));
  it("cobre, cosφ = 0.9 (R y X)", () => check("tabla-1-impedancia-cu", CU_COS09, 0.9));
  it("aluminio, cosφ = 1", () => check("tabla-2-impedancia-al", AL_COS1, 1));
});

describe("IEC 60364 (ABB): factores, conductor de protección y capacidades", () => {
  it("factores de temperatura decrecen con la temperatura (salvo la anomalía ABB-1 registrada)", () => {
    for (const id of ["tabla-4-temperatura-aire", "tabla-10-temperatura-terreno"]) {
      const t = ds.table(id, "factor-table");
      t.data.columns.forEach((c, j) => {
        const vals = t.data.rows.map((r) => r.values[j]).filter((v): v is number => v !== null);
        for (let i = 1; i < vals.length; i++) {
          if (id === "tabla-4-temperatura-aire" && c.id === "mineral-70" && i === 6) continue; // ABB-1: 45 °C = 0.87
          expect(vals[i]!, `${id} ${c.id} #${i}`).toBeLessThan(vals[i - 1]!);
        }
      });
    }
  });

  it("agrupamiento: factores no crecientes con el número de circuitos", () => {
    const t = ds.table("tabla-5-agrupamiento", "factor-table");
    for (const r of t.data.rows) {
      const vals = r.values.filter((v): v is number => v !== null);
      for (let i = 1; i < vals.length; i++) expect(vals[i]!).toBeLessThanOrEqual(vals[i - 1]!);
    }
  });

  it("capacidades en orden creciente y sin duplicados", () => {
    const s = ds.table("capacidades-interruptores", "standard-ratings").data.inverseTimeA;
    expect([...s].sort((a, b) => a - b)).toEqual(s);
    expect(new Set(s).size).toBe(s.length);
  });

  it("todas las tablas están registradas en verificacion.json con su estado", () => {
    for (const id of ds.ids()) expect(["fuente_secundaria", "verificado", "por_verificar"]).toContain(ds.status(id).status);
  });
});

// ---------------------------------------------------------------- Comparación con la capa de texto (si está disponible)

const TEXT = fileURLToPath(new URL("../../../referencias/normas/_texto/1SDC010001D0204.txt", import.meta.url));

describe.skipIf(!existsSync(TEXT))("IEC 60364 (ABB): cada valor aparece en la capa de texto de su página", () => {
  const pages = existsSync(TEXT) ? readFileSync(TEXT, "utf8").split("\f") : [];
  const numbersOn = (pageNos: number[]) => {
    const counts = new Map<number, number>();
    for (const p of pageNos)
      for (const m of (pages[p - 1] ?? "").matchAll(/\d+(?:[.,]\d+)?/g)) {
        const v = Number(m[0].replace(",", "."));
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    return counts;
  };
  const expectAllPresent = (values: number[], pageNos: number[]) => {
    const counts = numbersOn(pageNos);
    const missing: number[] = [];
    for (const v of values) {
      const c = counts.get(v) ?? 0;
      if (c === 0) missing.push(v);
      else counts.set(v, c - 1);
    }
    return missing;
  };

  it("Tabla 8 y Tabla 15", () => {
    // Las celdas de B1/B2 > 120 mm² vienen de la edición 2009, no de ABB: no se buscan en su texto.
    const fromAbb = (c: (typeof air)["data"]["columns"][number], i: number, t: typeof air) => !((c.method === "B1" || c.method === "B2") && t.data.sizesMm2[i]! > 120);
    const vals = (t: typeof air) => t.data.columns.flatMap((c) => c.values.filter((v, i): v is number => v !== null && fromAbb(c, i, t)));
    // La capa de texto pega dos números en uno en una celda de F (p. 43/44: «845» = 84 y 5 de otra línea);
    // se reportan los faltantes para revisarlos contra la imagen.
    const missingAir = expectAllPresent(vals(air), [41, 42, 43, 44]);
    expect(missingAir.length, `faltan en el texto: ${missingAir.join(", ")}`).toBeLessThanOrEqual(2);
    expect(expectAllPresent(vals(ground), [51])).toEqual([]);
  });

  it("factores e impedancias", () => {
    const f = (id: string) => ds.table(id, "factor-table").data.rows.flatMap((r) => r.values.filter((v): v is number => v !== null));
    expect(expectAllPresent(f("tabla-4-temperatura-aire"), [34])).toEqual([]);
    expect(expectAllPresent(f("tabla-10-temperatura-terreno"), [47])).toEqual([]);
    expect(expectAllPresent(f("tabla-5-agrupamiento"), [37])).toEqual([]);
    for (const id of ["tabla-1-impedancia-cu", "tabla-2-impedancia-al"]) {
      const t = ds.table(id, "cable-impedance");
      const v = t.data.rows.flatMap((r) => [r.singleCore.rOhmPerKm, r.singleCore.xOhmPerKm, r.multiCore.rOhmPerKm, r.multiCore.xOhmPerKm]);
      expect(expectAllPresent(v, [61]), id).toEqual([]);
    }
  });
});
