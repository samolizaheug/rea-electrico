/**
 * @rea/norms — catálogo de módulos normativos.
 * Para agregar una norma: implementar `NormModule` (ver @rea/engine) y registrarla aquí.
 */
import { unavailableNormModule, type NormModule } from "@rea/engine";
import { iec60364_2001 } from "./iec-60364-2001";
import { nom001Sede2012 } from "./nom-001-sede-2012";

export * from "./nom-001-sede-2012";
export * from "./iec-60364-2001";

const NEC_REASON = "Tablas del NEC pendientes de captura (ver packages/norm-data/plantillas/nec).";
const IEC_REASON = "Edición vigente de IEC 60364-5-52 sin fuente disponible; use la edición 2001 (fuente secundaria ABB).";

export const normModules: NormModule[] = [
  nom001Sede2012,
  unavailableNormModule("nec", "2020", "NEC (NFPA 70) 2020", NEC_REASON),
  unavailableNormModule("nec", "2023", "NEC (NFPA 70) 2023", NEC_REASON),
  unavailableNormModule("nec", "2026", "NEC (NFPA 70) 2026", NEC_REASON),
  iec60364_2001,
  unavailableNormModule("iec-60364", "2009+A1:2024", "IEC 60364-5-52:2009+A1:2024", IEC_REASON),
];

export function getNormModule(id: string, edition: string): NormModule {
  return normModules.find((m) => m.id === id && m.edition === edition) ?? unavailableNormModule(id, edition, `${id} ${edition}`, "Norma no registrada.");
}
