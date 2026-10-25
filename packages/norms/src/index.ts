/**
 * @rea/norms — catálogo de módulos normativos.
 * Para agregar una norma: implementar `NormModule` (ver @rea/engine) y registrarla aquí.
 */
import { unavailableNormModule, type NormModule } from "@rea/engine";
import { iec60364_2001 } from "./iec-60364-2001";
import { nom001Sede2012 } from "./nom-001-sede-2012";

export * from "./nom-001-sede-2012";
export * from "./iec-60364-2001";

const IEC_REASON = "Edición vigente de IEC 60364-5-52 sin fuente disponible; use la edición 2001 (fuente secundaria ABB).";

/**
 * El NEC (NFPA 70) no se incluye: su texto tiene derechos de autor y no hay fuente gratuita
 * (decisión del usuario, 2026-10-25). Se usa la NOM-001-SEDE-2012, documento público basado en
 * el NEC 2011. Un modo NEC se agregaría como conjunto de datos aparte, con fuente autorizada.
 */
export const normModules: NormModule[] = [
  nom001Sede2012,
  iec60364_2001,
  unavailableNormModule("iec-60364", "2009+A1:2024", "IEC 60364-5-52:2009+A1:2024", IEC_REASON),
];

export function getNormModule(id: string, edition: string): NormModule {
  return normModules.find((m) => m.id === id && m.edition === edition) ?? unavailableNormModule(id, edition, `${id} ${edition}`, "Norma no registrada.");
}
