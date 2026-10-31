import { describe, expect, it } from "vitest";
import {
  cargaAlumbradoVAm2,
  cargaRestaurante,
  conductorElectrodoTierra,
  demandaEscuelasVAm2,
  demandaEstufas,
  demandaMultifamiliar,
  demandaSecadoras,
  dimensionConductor,
  getNormDataset,
  llenadoMaxPct,
  proteccionMaxConductorPequeno,
} from "../src";
import { compararConExterna } from "../src/cotejo-externo";

/**
 * NOM-001-SEDE-2012: pruebas al cargar los datos.
 * - Cotejo con la extracción independiente del mismo PDF entregada por el usuario.
 * - Consistencia física de las tablas y casos conocidos.
 * - Consultas tipadas de las tablas importadas (cada resultado trae su referencia y página).
 */
const nom = getNormDataset("nom-001-sede", "2012");

describe("cotejo con la extracción independiente (fuentes/nom-001-sede-2012-externa)", () => {
  const r = compararConExterna();
  it("las 15 tablas comunes coinciden celda por celda, salvo la errata E8 aprobada", () => {
    const diffs = r.flatMap((t) => t.diffs.map((d) => `${t.ours}: ${d}`));
    // E8 (aprobada el 2026-10-24): 430-250, 40 hp síncrono a 230 V. El DOF publica 93 A; se usa 83 A.
    expect(diffs).toEqual(["tabla-430-250: 40 hp sinc_A_230V: proyecto=83 externa=93"]);
    expect(r.length).toBe(15);
    expect(r.reduce((s, t) => s + t.compared, 0)).toBeGreaterThan(2500);
  });
});

describe("ampacidades (Tablas 310-15(b)(16) y (17))", () => {
  for (const id of ["tabla-310-15-b-16", "tabla-310-15-b-17"]) {
    const t = nom.table(id, "ampacity");
    it(`${id}: crece con el calibre, 60 ≤ 75 ≤ 90 °C y Al < Cu`, () => {
      for (const mat of ["cu", "al"] as const)
        t.data.temperaturesC.forEach((_, j) => {
          const col = t.data.rows.map((r) => r[mat][j]).filter((v): v is number => v !== null && v !== undefined);
          for (let i = 1; i < col.length; i++) expect(col[i]!, `${mat} col ${j} #${i}`).toBeGreaterThan(col[i - 1]!);
        });
      for (const r of t.data.rows) {
        for (const mat of ["cu", "al"] as const) {
          const v = r[mat].filter((x): x is number => x !== null);
          for (let j = 1; j < v.length; j++) expect(v[j]!, `${r.designation} ${mat}`).toBeGreaterThanOrEqual(v[j - 1]!);
        }
        r.cu.forEach((c, j) => {
          const a = r.al[j];
          if (c !== null && a !== null && a !== undefined) expect(a, `${r.designation} Al < Cu`).toBeLessThan(c);
        });
      }
    });
  }

  it("caso conocido: 4/0 AWG Cu a 75 °C = 230 A", () => {
    const t = nom.table("tabla-310-15-b-16", "ampacity");
    expect(t.data.rows.find((r) => r.designation === "4/0")!.cu[t.data.temperaturesC.indexOf(75)]).toBe(230);
  });
});

describe("Capítulo 10", () => {
  it("Tabla 4: área 100 % ≈ π·d²/4 y columnas 60/53/31/40 % consistentes", () => {
    for (const s of nom.table("cap10-tabla-4", "raceway-dimensions").data.sections)
      for (const r of s.rows) {
        if (r.internalDiameterMm === null || r.totalAreaMm2 === null) continue;
        const a = (Math.PI * r.internalDiameterMm ** 2) / 4;
        expect(Math.abs(a - r.totalAreaMm2) / r.totalAreaMm2, `${s.id} ${r.metricDesignation}`).toBeLessThan(0.02);
        for (const [v, pct] of [
          [r.area60Mm2, 0.6],
          [r.fill1Mm2, 0.53],
          [r.fill2Mm2, 0.31],
          [r.fillOver2Mm2, 0.4],
        ] as const)
          if (v !== null) expect(Math.abs(v - pct * r.totalAreaMm2), `${s.id} ${r.metricDesignation} ${pct}`).toBeLessThanOrEqual(Math.max(1.5, 0.02 * v));
      }
  });

  it("Tabla 9: Z eficaz ≈ R·0.85 + XL·0.527 (±8 %)", () => {
    for (const r of nom.table("cap10-tabla-9", "ac-impedance").data.rows) {
      const xl = { pvc: r.xlOhmPerKm.pvcOAluminio, aluminio: r.xlOhmPerKm.pvcOAluminio, acero: r.xlOhmPerKm.acero };
      for (const [R, Z] of [
        [r.rCuOhmPerKm, r.zCuOhmPerKm],
        [r.rAlOhmPerKm, r.zAlOhmPerKm],
      ] as const)
        for (const c of ["pvc", "aluminio", "acero"] as const) {
          if (R[c] === null || Z[c] === null) continue;
          const z = R[c]! * 0.85 + xl[c] * Math.sqrt(1 - 0.85 ** 2);
          expect(Math.abs(z - Z[c]!) / Z[c]!, `${r.designation} ${c}`).toBeLessThanOrEqual(0.08);
        }
    }
  });

  it("Tabla 5 (importada): área ≈ π·d²/4 en todos los renglones; erratas del DOF registradas", () => {
    const t = nom.table("cap10-tabla-5", "rows-table");
    for (const r of t.data.rows) {
      const d = Number(r.diametro_aprox_mm);
      const a = Number(r.area_aprox_mm2);
      expect(Math.abs((Math.PI * d * d) / 4 - a) / a, `${r.tipo_aislamiento} ${r.awg_kcmil}`).toBeLessThan(0.02);
    }
    expect(t.errata.length).toBe(15);
    expect(t.errata.find((e) => e.path.endsWith("area_aprox_mm2") && e.asPublished === 55.68)).toBeTruthy();
    expect(dimensionConductor("THHN", "12")).toMatchObject({ diametroMm: expect.any(Number), cita: { referencia: "Capítulo 10, Tabla 5", paginas: [932] } });
  });

  it("Tabla 1: 53 / 31 / 40 %", () => {
    expect([1, 2, 3, 10].map((n) => llenadoMaxPct(n).pct)).toEqual([53, 31, 40, 40]);
  });
});

describe("casos conocidos y consultas tipadas (cada una con referencia y página)", () => {
  it("Tabla 250-122: protección de 100 A → 8 AWG Cu", () => {
    const row = nom.table("tabla-250-122", "egc-size").data.rows.find((r) => r.maxRatingA >= 100)!;
    expect(row.cu.designation).toBe("8");
  });

  it("Tabla 430-250: motor trifásico de 10 hp a 460 V = 14 A", () => {
    const t = nom.table("tabla-430-250", "motor-flc");
    const g = t.data.groups.find((x) => x.id === "induccion")!;
    expect(t.data.rows.find((r) => r.hp === "10")!.currentsA.induccion![g.voltagesV.indexOf(460)]).toBe(14);
  });

  it("240-4(d): 14 → 15 A, 12 → 20 A, 10 → 30 A (el DOF no publica los incisos de aluminio)", () => {
    expect(["14", "12", "10"].map((d) => proteccionMaxConductorPequeno(d)!.maxA)).toEqual([15, 20, 30]);
    expect(proteccionMaxConductorPequeno("8")).toBeNull();
    expect(proteccionMaxConductorPequeno("14")!.cita).toMatchObject({ referencia: "240-4(d)", paginas: [89] });
  });

  it("Tabla 250-66: acometida 33.6 mm² → 8 AWG; 107 mm² (4/0) → 2 AWG; 600 mm² → 3/0", () => {
    expect(conductorElectrodoTierra(33.6).cu).toBe("8");
    expect(conductorElectrodoTierra(107.2).cu).toBe("2");
    expect(conductorElectrodoTierra(600).cu).toBe("3/0");
    expect(conductorElectrodoTierra(33.6).cita.texto).toBe("NOM-001-SEDE-2012 Tabla 250-66 (p. 122 del PDF)");
  });

  it("Art. 220: alumbrado, secadoras, estufas, multifamiliares, escuelas y restaurantes", () => {
    expect(cargaAlumbradoVAm2("Escuelas")!.vaPorM2).toBe(33);
    expect(demandaSecadoras(15).pct).toBe(43); // 47 % − 1 % × (15 − 11)
    expect(demandaSecadoras(30).pct).toBe(31.5); // 35 % − 0.5 % × (30 − 23)
    expect(demandaSecadoras(50).pct).toBe(25);
    expect(demandaEstufas(30).colCkW).toBe(45); // 15 kW + 1 kW × 30
    expect(demandaEstufas(50).colCkW).toBe(62.5); // 25 kW + 0.75 kW × 50
    expect(demandaMultifamiliar(20).pct).toBe(38);
    expect(demandaEscuelasVAm2(100).demandaVAm2).toBeCloseTo(33 + 0.75 * 67, 9);
    expect(cargaRestaurante(250, true).kVA).toBeCloseTo(0.1 * 50 + 160, 9);
    expect(cargaRestaurante(150, false).kVA).toBeCloseTo(150, 9);
  });

  it("toda tabla NOM tiene referencia, página y registro de verificación", () => {
    for (const id of nom.ids()) {
      const t = nom.table(id);
      expect(t.source.pages.length, id).toBeGreaterThan(0);
      expect(nom.status(id).status, id).toBe("verificado");
    }
  });
});
