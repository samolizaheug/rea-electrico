import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Documentos fuente conocidos. La huella garantiza que se extrae del documento esperado. */
export const SOURCES = {
  "nom-001-sede-2012": {
    file: "NOM-001-SEDE-2012 Instalaciones Electricas (utilizacion).pdf",
    sha256: "7774318D1549550F2E07733DEE10485486AD17BCDA71361C737C8B68309BCBA1",
    publication: "DOF 29/11/2012",
  },
} as const;

export type SourceId = keyof typeof SOURCES;

export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const NORMS_DIR = `${REPO_ROOT}referencias/normas/`;
export const TEXT_DIR = `${NORMS_DIR}_texto/`;
export const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));

export function sourcePdfPath(id: SourceId): string {
  return `${NORMS_DIR}${SOURCES[id].file}`;
}

export function textPath(id: SourceId): string {
  return `${TEXT_DIR}${id}.txt`;
}

/** Verifica que el PDF en disco sea exactamente el documento registrado. */
export function assertSourceHash(id: SourceId): void {
  const actual = createHash("sha256").update(readFileSync(sourcePdfPath(id))).digest("hex").toUpperCase();
  if (actual !== SOURCES[id].sha256) {
    throw new Error(`La huella de ${SOURCES[id].file} no coincide (esperada ${SOURCES[id].sha256}, obtenida ${actual}).`);
  }
}
