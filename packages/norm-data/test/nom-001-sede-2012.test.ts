import { describe, expect, it } from "vitest";
import { availableDatasets, getNormDataset } from "../src";
import { findAnomalies } from "../src/sanity";

const nom = getNormDataset("nom-001-sede", "2012");

/**
 * Anomalías conocidas y PENDIENTES de decisión del usuario. Si aparece una nueva,
 * esta prueba falla para obligar a revisarla contra el PDF antes de seguir.
 */
const PENDING_ANOMALIES: string[] = [];

describe("NOM-001-SEDE-2012: conjunto de tablas", () => {
  it("está registrado y todas las tablas cumplen el formato", () => {
    expect(availableDatasets()).toContain("nom-001-sede-2012");
    expect(nom.ids()).toEqual(
      [
        "art-240-6-a",
        "cap10-tabla-4",
        "cap10-tabla-8",
        "cap10-tabla-9",
        "tabla-220-42",
        "tabla-220-44",
        "tabla-250-122",
        "tabla-310-104-a",
        "tabla-310-15-b-16",
        "tabla-310-15-b-17",
        "tabla-310-15-b-2-a",
        "tabla-310-15-b-2-b",
        "tabla-310-15-b-3-a",
        "tabla-392-22-a",
        "tabla-430-22-e",
        "tabla-430-247",
        "tabla-430-248",
        "tabla-430-250",
        "tabla-430-52",
        // Importadas de la extracción entregada por el usuario (2026-10-25).
        "art-240-4-d",
        "tabla-220-12",
        "tabla-220-54",
        "tabla-220-55",
        "tabla-220-56",
        "tabla-220-84",
        "tabla-220-86",
        "tabla-220-88",
        "tabla-250-66",
        "cap10-tabla-1",
        "cap10-tabla-5",
        "cap10-tabla-5a",
      ].sort(),
    );
  });

  it("cada tabla cita su fuente con huella y páginas", () => {
    for (const id of nom.ids()) {
      const t = nom.table(id);
      expect(t.source.sha256).toBe("7774318D1549550F2E07733DEE10485486AD17BCDA71361C737C8B68309BCBA1");
      expect(t.source.pages.length).toBeGreaterThan(0);
      expect(t.norm).toEqual({ id: "nom-001-sede", edition: "2012" });
    }
  });

  it("la consistencia interna no muestra anomalías nuevas", () => {
    const found = nom.ids().flatMap((id) => findAnomalies(nom.table(id))).map((a) => `${a.tableId} | ${a.where}`);
    expect(found).toEqual(PENDING_ANOMALIES);
  });
});

describe("valores de control (leídos del PDF)", () => {
  it("Tabla 310-15(b)(16)", () => {
    const t = nom.table("tabla-310-15-b-16", "ampacity");
    const row = (d: string) => t.data.rows.find((r) => r.designation === d)!;
    expect(row("4/0").cu).toEqual([195, 230, 260]);
    expect(row("4/0").al).toEqual([150, 180, 205]);
    expect(row("12").cu).toEqual([20, 25, 30]);
    expect(row("12").smallConductorLimit).toBe(true);
    expect(row("8").smallConductorLimit).toBe(false);
    expect(row("18").cu).toEqual([null, null, 14]);
    expect(row("2000").cu).toEqual([555, 665, 750]);
  });

  it("Tabla 310-15(b)(2)(a) con la errata 71-75 aplicada", () => {
    const t = nom.table("tabla-310-15-b-2-a", "temperature-correction");
    const r = t.data.rows.find((x) => x.ambientToC === 75)!;
    expect(r.ambientFromC).toBe(71);
    expect(r.factors).toEqual([null, null, 0.5]);
    expect(t.errata[0]!.asPublished).toBe("91-75");
    expect(t.data.rows.find((x) => x.ambientToC === 40)!.factors).toEqual([0.82, 0.88, 0.91]);
  });

  it("Tabla 310-15(b)(3)(a)", () => {
    const t = nom.table("tabla-310-15-b-3-a", "adjustment-factors");
    expect(t.data.rows.map((r) => r.percent)).toEqual([80, 70, 50, 45, 40, 35]);
    expect(t.data.rows[5]).toEqual({ conductorsFrom: 41, conductorsTo: null, percent: 35 });
  });

  it("240-6(a) incluye 16, 32 y 63 A", () => {
    const t = nom.table("art-240-6-a", "standard-ratings");
    expect(t.data.inverseTimeA).toEqual(expect.arrayContaining([15, 16, 20, 32, 63, 800, 6000]));
    expect(t.data.additionalFuseA).toEqual([1, 3, 6, 10, 601]);
  });

  it("Tabla 250-122", () => {
    const t = nom.table("tabla-250-122", "egc-size");
    const r200 = t.data.rows.find((r) => r.maxRatingA === 200)!;
    expect(r200.cu.designation).toBe("6");
    expect(r200.al?.designation).toBe("4");
    expect(t.data.rows.find((r) => r.maxRatingA === 15)!.al).toBeNull();
  });

  it("Tabla 430-250 con la errata de 10 hp / 575 V y el renglón de 250 hp", () => {
    const t = nom.table("tabla-430-250", "motor-flc");
    const row = (hp: string) => t.data.rows.find((r) => r.hp === hp)!;
    expect(row("10").currentsA.induccion).toEqual([null, 32.3, 30.8, 28, 14, 11, null]);
    expect(row("1 1/2").currentsA.induccion).toEqual([12, 6.9, 6.6, 6, 3, 2.4, null]);
    expect(row("250").currentsA.induccion).toEqual([null, null, null, null, 302, 242, 60]);
    expect(row("250").currentsA["sincrono-fp1"]).toEqual([null, null, null, null]);
    expect(row("40").currentsA["sincrono-fp1"]).toEqual([83, 41, 33, null]);
    expect(t.errata.map((e) => e.asPublished)).toEqual([44, 93]);
  });

  it("Tabla 430-247 con la errata de 150 hp / 500 V", () => {
    const t = nom.table("tabla-430-247", "motor-flc");
    expect(t.data.rows.find((r) => r.hp === "150")!.currentsA.armadura).toEqual([null, 506, 246]);
  });

  it("Tabla 430-248 interpreta 1/6 hp", () => {
    const t = nom.table("tabla-430-248", "motor-flc");
    expect(t.data.rows[0]).toMatchObject({ hp: "1/6", kW: 0.12 });
  });

  it("Tabla 430-52", () => {
    const t = nom.table("tabla-430-52", "motor-protection");
    expect(t.data.rows.find((r) => r.motorType === "jaula-b-eficiente")!.percents).toEqual([300, 175, 1100, 250]);
    expect(t.data.rows.find((r) => r.motorType === "cc")!.percents).toEqual([150, 150, 250, 150]);
  });

  it("Capítulo 10, Tablas 8 y 9", () => {
    const t8 = nom.table("cap10-tabla-8", "conductor-properties");
    expect(t8.data.rows.filter((r) => r.designation === "12").map((r) => r.strands)).toEqual([1, 7]);
    const t9 = nom.table("cap10-tabla-9", "ac-impedance");
    const r = t9.data.rows.find((x) => x.designation === "4/0")!;
    expect(r.rCuOhmPerKm).toEqual({ pvc: 0.203, aluminio: 0.22, acero: 0.207 });
    expect(r.xlOhmPerKm).toEqual({ pvcOAluminio: 0.135, acero: 0.167 });
  });
});

describe("canalizaciones (Capítulo 10 Tabla 4 y Tabla 392-22(a))", () => {
  it("Tabla 4: 12 secciones; valores de control", () => {
    const t = nom.table("cap10-tabla-4", "raceway-dimensions");
    expect(t.data.sections.map((s) => s.id)).toEqual(["emt", "ent", "fmc", "imc", "lfnc-b", "lfnc-a", "lfmc", "rmc", "pvc-80", "pvc-40-hdpe", "pvc-a", "pvc-eb"]);
    const row = (sec: string, d: number) => t.data.sections.find((s) => s.id === sec)!.rows.find((r) => r.metricDesignation === d)!;
    expect(row("emt", 53)).toMatchObject({ tradeSize: "2", internalDiameterMm: 52.5, totalAreaMm2: 2165, fillOver2Mm2: 866 });
    expect(row("rmc", 155)).toMatchObject({ tradeSize: "6", internalDiameterMm: 154.8, fillOver2Mm2: 7528 });
    expect(row("pvc-80", 53).internalDiameterMm).toBe(48.6);
    expect(row("pvc-eb", 53).internalDiameterMm).toBe(56.4);
    expect(row("imc", 12).internalDiameterMm).toBeNull();
    expect(row("fmc", 12).tradeSize).toBe("3/8");
    expect(row("pvc-40-hdpe", 35).tradeSize).toBe("1 1/4");
  });

  it("Tabla 392-22(a): anchos de 5 a 90 cm", () => {
    const t = nom.table("tabla-392-22-a", "tray-fill");
    expect(t.data.rows.map((r) => r.widthCm)).toEqual([5, 10, 15, 20, 22.5, 30, 40, 45, 50, 60, 75, 90]);
    expect(t.data.rows.find((r) => r.widthCm === 30)).toEqual({ widthCm: 30, ladderMm2: 9000, solidMm2: 7100, ladderSdFactor: 30, solidSdFactor: 25 });
  });
});

describe("estado de verificación", () => {
  it("todas las tablas tienen una verificación vigente (huella igual a los datos actuales)", () => {
    for (const id of nom.ids()) expect(nom.status(id).status, id).toBe("verificado");
  });
});
