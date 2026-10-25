import type { EnumOption, ParamValue } from "@rea/core";
import type { NormModule, VoltageDropCriteria } from "@rea/engine";
import { iecCalc, iecData } from "./calc";
import { IEC_METHODS, iecMethod } from "./methods";
import { iecSizing } from "./sizing";

export { iecCalc } from "./calc";
export { IEC_METHODS, iecMethod, type IecMethod } from "./methods";
export { iecSizing } from "./sizing";

/**
 * IEC 60364-5-52:2001 (con 4-43 y 5-54), con las tablas de la fuente secundaria ABB SACE,
 * Electrical installation handbook Vol. 2, 4.ª ed. (2006). La memoria marca cada valor como
 * tomado de fuente secundaria hasta su cotejo con la norma IEC.
 */

/**
 * IEC 60364-5-52:2001, 525 (citado en ABB cap. 2.2.2): recomendación de 4 % entre el origen de la
 * instalación del usuario y el equipo. No distingue alimentador y derivado: se usa el mismo valor.
 */
const SRC_525 = "IEC 60364-5-52:2001, 525, citado en ABB EIH Vol. 2 cap. 2.2.2 (recomendación; límite único desde el origen de la instalación)";
export const IEC_VOLTAGE_DROP: VoltageDropCriteria = {
  branch: { pct: 4, mandatory: false, source: SRC_525 },
  feeder: { pct: 4, mandatory: false, source: SRC_525 },
  total: { pct: 4, mandatory: false, source: SRC_525 },
  special: [],
};

const cache = new Map<string, EnumOption[]>();
function cached(key: string, build: () => EnumOption[]): EnumOption[] {
  const hit = cache.get(key);
  if (hit) return hit;
  const v = build();
  cache.set(key, v);
  return v;
}

export const iec60364_2001: NormModule = {
  id: "iec-60364",
  edition: "2001",
  label: "IEC 60364-5-52:2001 (fuente secundaria ABB)",
  available: true,
  voltageDrop: IEC_VOLTAGE_DROP,
  calc: iecCalc,
  sizing: iecSizing,
  refs: { voltageDrop: ["ABB EIH Vol. 2 cap. 2.2.2, ec. (1): ΔU = k · Ib · L/n · (r cosφ + x senφ)"] },
  methodNote:
    "Nominal: Ib con la tensión nominal; caída ΔU = k·Ib·(r·cosφ + x·senφ)·L/n con r a 80 °C y x ajustada a la frecuencia (ABB cap. 2.2.2). Datos IEC tomados de fuente secundaria (ABB, 2006). El barrido fasorial queda como referencia.",
  isBuried: (m) => iecMethod(m)?.method === "D",
  options(provider) {
    switch (provider) {
      case "norm:insulationTypes":
        return cached(provider, () => [
          { value: "PVC", label: "PVC" },
          { value: "XLPE", label: "XLPE / EPR" },
        ]);
      case "norm:installationMethods":
        return cached(provider, () => IEC_METHODS.map((m) => ({ value: m.value, label: m.label, group: m.group })));
      case "norm:conductorSizes":
        return cached(provider, () => iecData().table("ampacidad-aire", "iec-ampacity").data.sizesMm2.map((s) => ({ value: String(s), label: `${s} mm²` })));
      case "norm:racewaySizes":
        // La fuente no da dimensiones de canalizaciones.
        return [];
      default:
        return undefined;
    }
  },
  paramDefaults(type): Record<string, ParamValue> {
    // Conductores unipolares de PVC en tubo sobre pared: método de referencia B1.
    if (type === "cable") return { insulationType: "PVC", installationMethod: "B1" };
    return {};
  },
};
