import type { EnumOption, ParamValue } from "@rea/core";
import type { NormModule } from "@rea/engine";
import { getNormDataset } from "@rea/norm-data";

/**
 * Módulo NOM-001-SEDE-2012. En la E4 provee las opciones de los parámetros dependientes
 * de la norma; en la E6 se agregan los criterios de dimensionamiento.
 */
const data = () => getNormDataset("nom-001-sede", "2012");

/**
 * Métodos de instalación de la fase 1 y la tabla de ampacidad / columna de la Tabla 9 que usan.
 * Charolas (392-80) y otras condiciones especiales quedan para fases posteriores.
 */
export const INSTALLATION_METHODS = [
  { value: "conduit-pvc", label: "Tubo conduit de PVC", ampacityTable: "tabla-310-15-b-16", conduit: "pvc" },
  { value: "conduit-aluminio", label: "Tubo conduit de aluminio", ampacityTable: "tabla-310-15-b-16", conduit: "aluminio" },
  { value: "conduit-acero", label: "Tubo conduit de acero", ampacityTable: "tabla-310-15-b-16", conduit: "acero" },
  { value: "enterrado", label: "Directamente enterrado", ampacityTable: "tabla-310-15-b-16", conduit: null },
  { value: "aire-libre", label: "Conductores individuales al aire libre", ampacityTable: "tabla-310-15-b-17", conduit: null },
] as const;

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

const cache = new Map<string, EnumOption[]>();

export const nom001Sede2012: NormModule = {
  id: "nom-001-sede",
  edition: "2012",
  label: "NOM-001-SEDE-2012",
  available: true,
  options(provider) {
    const hit = cache.get(provider);
    if (hit) return hit;
    let opts: EnumOption[] | undefined;
    if (provider === "norm:insulationTypes") opts = insulationOptions();
    else if (provider === "norm:installationMethods") {
      opts = INSTALLATION_METHODS.map((m) => ({ value: m.value, label: `${m.label} — ${m.ampacityTable === "tabla-310-15-b-17" ? "Tabla 310-15(b)(17)" : "Tabla 310-15(b)(16)"}` }));
    } else if (provider === "norm:conductorSizes") opts = sizeOptions();
    if (opts) cache.set(provider, opts);
    return opts;
  },
  paramDefaults(type): Record<string, ParamValue> {
    // THHW-LS en tubo conduit de PVC: la combinación más común en instalaciones en México.
    if (type === "cable") return { insulationType: "THHW-LS", installationMethod: "conduit-pvc" };
    return {};
  },
};
