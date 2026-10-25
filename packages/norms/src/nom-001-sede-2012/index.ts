import type { EnumOption, ParamValue } from "@rea/core";
import type { NormModule, VoltageDropCriteria } from "@rea/engine";
import { getNormDataset } from "@rea/norm-data";
import { nomCalc } from "./calc";
import { nomSizing } from "./sizing";
import { DUCT_SIZES, RACEWAY_METHODS, racewayMethod } from "./raceways";

export { hpToNumber, nomCalc } from "./calc";
export { nomSizing } from "./sizing";

export { DUCT_SIZES, DUCT_SIZES_SOURCE, RACEWAY_METHODS, racewayMethod } from "./raceways";
export type { RacewayMethod } from "./raceways";

/**
 * Módulo NOM-001-SEDE-2012. Provee las opciones de los parámetros dependientes de la norma,
 * los criterios de caída de tensión y, desde la E6, los criterios de dimensionamiento.
 */
const data = () => getNormDataset("nom-001-sede", "2012");

/** Límites de caída de tensión de la NOM-001-SEDE-2012. */
export const NOM_VOLTAGE_DROP: VoltageDropCriteria = {
  branch: { pct: 3, mandatory: false, source: "NOM-001-SEDE-2012 210-19(a) Nota 4 (recomendación)" },
  feeder: { pct: 3, mandatory: false, source: "NOM-001-SEDE-2012 215-2(a)(1) Nota 2 (recomendación)" },
  total: { pct: 5, mandatory: false, source: "NOM-001-SEDE-2012 210-19(a) Nota 4 y 215-2(a)(1) Nota 2 (recomendación)" },
  special: [
    {
      id: "electronico-sensible",
      label: "Equipo electrónico sensible",
      branch: { pct: 1.5, mandatory: true, source: "NOM-001-SEDE-2012 647-4(d)" },
      total: { pct: 2.5, mandatory: true, source: "NOM-001-SEDE-2012 647-4(d)" },
    },
    {
      id: "bomba-contra-incendio",
      label: "Bomba contra incendio",
      motorRunning: { pct: 5, atCurrentPctOfFlc: 115, mandatory: true, source: "NOM-001-SEDE-2012 695-7(b)" },
      motorStarting: { pct: 15, mandatory: true, source: "NOM-001-SEDE-2012 695-7(a)" },
    },
  ],
};

function insulationOptions(): EnumOption[] {
  return data()
    .table("tabla-310-104-a", "insulation-types")
    .data.rows.map((r) => ({
      value: r.type,
      label: `${r.type} (${r.ratings.map((x) => `${x.temperatureC} °C ${x.locations.toLowerCase().replace("lugares ", "")}`).join("; ")})`,
    }));
}

function sizeOptions(): EnumOption[] {
  return data()
    .table("tabla-310-15-b-16", "ampacity")
    .data.rows.filter((r) => !["18", "16"].includes(r.designation))
    .map((r) => ({ value: r.designation, label: `${r.designation} ${r.system} (${r.areaMm2} mm²)` }));
}

function methodOptions(): EnumOption[] {
  return RACEWAY_METHODS.map((m) => ({
    value: m.value,
    group: m.group,
    label: `${m.label} — Art. ${m.article}${m.ampacityTable === "tabla-310-15-b-17" ? ", Tabla 310-15(b)(17)" : m.ampacityTable ? "" : ", 392-80"}`,
  }));
}

/** Medidas comerciales según el método de instalación del cable. [] = no aplica. */
function racewaySizeOptions(params: Record<string, ParamValue> | undefined): EnumOption[] | undefined {
  const m = racewayMethod(params?.installationMethod);
  if (!m) return [];
  switch (m.sizes.kind) {
    case "ninguna":
      return [];
    case "ducto-catalogo":
      return DUCT_SIZES.map((d) => ({ ...d, label: `${d.label} — catálogo de fabricante` }));
    case "charola":
      return data()
        .table("tabla-392-22-a", "tray-fill")
        .data.rows.map((r) => ({ value: String(r.widthCm), label: `${r.widthCm * 10} mm de ancho (${r.widthCm} cm) — Tabla 392-22(a)` }));
    case "tabla-4": {
      const section = data()
        .table("cap10-tabla-4", "raceway-dimensions")
        .data.sections.find((s) => s.id === (m.sizes as { section: string }).section);
      return section?.rows
        .filter((r) => r.internalDiameterMm !== null)
        .map((r) => ({ value: String(r.metricDesignation), label: `${r.metricDesignation} (${r.tradeSize}") — Ø int. ${r.internalDiameterMm} mm` }));
    }
  }
}

const cache = new Map<string, EnumOption[]>();
function cached(key: string, build: () => EnumOption[]): EnumOption[] {
  const hit = cache.get(key);
  if (hit) return hit;
  const v = build();
  cache.set(key, v);
  return v;
}

export const nom001Sede2012: NormModule = {
  id: "nom-001-sede",
  edition: "2012",
  label: "NOM-001-SEDE-2012",
  available: true,
  voltageDrop: NOM_VOLTAGE_DROP,
  calc: nomCalc,
  sizing: nomSizing,
  refs: { voltageDrop: ["NOM-001-SEDE-2012 Capítulo 10, Tabla 9, nota 2"], receptacleLoad: ["NOM-001-SEDE-2012 220-14(i)"] },
  methodNote: "Nominal (corrientes con la tensión nominal; caída con Ze de la Tabla 9). Es el método de la memoria; el barrido fasorial queda como referencia.",
  isBuried: (m) => m.startsWith("enterrado"),
  options(provider, params) {
    switch (provider) {
      case "norm:insulationTypes":
        return cached(provider, insulationOptions);
      case "norm:installationMethods":
        return cached(provider, methodOptions);
      case "norm:conductorSizes":
        return cached(provider, sizeOptions);
      case "norm:racewaySizes":
        return racewaySizeOptions(params);
      default:
        return undefined;
    }
  },
  paramDefaults(type): Record<string, ParamValue> {
    // THHW-LS en tubo conduit de PVC cédula 40: la combinación más común en instalaciones en México.
    if (type === "cable") return { insulationType: "THHW-LS", installationMethod: "conduit-pvc-40" };
    return {};
  },
};
