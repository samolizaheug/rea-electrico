import { describe, expect, it } from "vitest";
import { getNormDataset, perdidasTransformadorDistribucion } from "../src";

describe("NOM-002-SEDE-2010 Tabla 2 (pérdidas de transformadores de distribución)", () => {
  const t = getNormDataset("nom-002-sede", "2010").table("tabla-2", "rows-table");

  it("9 renglones monofásicos y 9 trifásicos; totales > en vacío y crecientes con la capacidad y el NBA", () => {
    for (const tipo of ["monofasico", "trifasico"]) {
      const rows = t.data.rows.filter((r) => r.tipo === tipo);
      expect(rows.length).toBe(9);
      for (const nba of [95, 150, 200]) {
        rows.forEach((r, i) => {
          expect(Number(r[`totales_${nba}`])).toBeGreaterThan(Number(r[`vacio_${nba}`]));
          if (i > 0) expect(Number(r[`totales_${nba}`])).toBeGreaterThan(Number(rows[i - 1]![`totales_${nba}`]));
        });
      }
      for (const r of rows) {
        expect(Number(r.totales_95)).toBeLessThan(Number(r.totales_150));
        expect(Number(r.totales_150)).toBeLessThan(Number(r.totales_200));
      }
    }
  });

  it("casos conocidos: 500 kVA trifásico clase 25 kV y 75 kVA clase 15 kV", () => {
    expect(perdidasTransformadorDistribucion(3, 500, 23000)).toMatchObject({ kvaTabla: 500, nbaKV: 150, vacioW: 1475, totalesW: 6073, cargaW: 4598, fueraDeAlcance: false });
    expect(perdidasTransformadorDistribucion(3, 75, 13200)).toMatchObject({ nbaKV: 95, cargaW: 1142 - 255 });
    expect(perdidasTransformadorDistribucion(3, 75, 33000)?.nbaKV).toBe(200);
  });

  it("capacidad intermedia: renglón inmediato superior (nota 3); fuera de tabla: null", () => {
    expect(perdidasTransformadorDistribucion(3, 100, 13200)?.kvaTabla).toBe(112.5);
    expect(perdidasTransformadorDistribucion(1, 50, 13200)?.kvaTabla).toBe(50);
    expect(perdidasTransformadorDistribucion(3, 750, 13200)).toBeNull();
    expect(perdidasTransformadorDistribucion(1, 250, 13200)).toBeNull();
    expect(perdidasTransformadorDistribucion(3, 75, 69000)).toBeNull();
  });

  it("primario en baja tensión: se marca fuera de alcance (estimación con NBA 95 kV)", () => {
    expect(perdidasTransformadorDistribucion(3, 75, 480)).toMatchObject({ nbaKV: 95, fueraDeAlcance: true });
  });
});
