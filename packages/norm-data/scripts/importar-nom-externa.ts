/**
 * Importa al conjunto `nom-001-sede-2012` las tablas de la extracción entregada por el usuario
 * (fuentes/nom-001-sede-2012-externa/) que el proyecto aún no tenía. Los valores se copian sin
 * modificar; las correcciones que la extracción ya trae (columna "nota") se registran como
 * erratas, con el valor publicado en el DOF.
 *
 * Las tablas que ya existían NO se importan: se cotejan (scripts/cotejar-nom-externa.ts).
 *
 * Uso: pnpm norm:importar-nom-externa
 */
import { writeFileSync } from "node:fs";
import externa from "../fuentes/nom-001-sede-2012-externa/tablas_NOM-001-SEDE-2012.json";
import { normTableSchema, type NormTable } from "../src/schema";
import { writeCatalogAndReport } from "./catalog-writer";
import { DATA_DIR, SOURCES } from "./sources";

type Cell = number | string | null;
const tablas = (externa as unknown as { tablas: Record<string, { referencia: string; descripcion: string; pagina_pdf: number; filas: Record<string, Cell>[] }> }).tablas;

/** Tablas nuevas: id externo → id del proyecto y artículo. */
const NUEVAS: [string, string, string][] = [
  ["240-4d_limite_ocpd_conductores_pequenos", "art-240-4-d", "240-4(d)"],
  ["220-12_carga_alumbrado_por_inmueble", "tabla-220-12", "220-12"],
  ["220-54_demanda_secadoras", "tabla-220-54", "220-54"],
  ["220-55_demanda_estufas", "tabla-220-55", "220-55"],
  ["220-56_demanda_cocina_no_vivienda", "tabla-220-56", "220-56"],
  ["220-84_opcional_multifamiliar", "tabla-220-84", "220-84"],
  ["220-86_opcional_escuelas", "tabla-220-86", "220-86"],
  ["220-88_opcional_restaurantes", "tabla-220-88", "220-88"],
  ["250-66_conductor_electrodo_tierra", "tabla-250-66", "250-66"],
  ["cap10-tabla1_porcentaje_llenado", "cap10-tabla-1", "Capítulo 10"],
  ["cap10-tabla5_dimensiones_conductores", "cap10-tabla-5", "Capítulo 10"],
  ["cap10-tabla5A_conductores_compactos", "cap10-tabla-5a", "Capítulo 10"],
];

const SRC = SOURCES["nom-001-sede-2012"];
const VERIFICADO = "Ing. RGLR";
const FECHA = "2026-10-25";

for (const [extId, id, article] of NUEVAS) {
  const t = tablas[extId];
  if (!t) throw new Error(`La extracción externa no trae la tabla ${extId}.`);
  const keys = [...new Set(t.filas.flatMap((r) => Object.keys(r)))].filter((k) => k !== "nota");
  const errata: NormTable["errata"] = [];
  const rows = t.filas.map((r, i) => {
    const row: Record<string, Cell> = {};
    for (const k of keys) row[k] = r[k] ?? null;
    const nota = typeof r.nota === "string" ? r.nota : null;
    if (nota) {
      // "mm2 impreso 6.63 corregido según AWG" · "ERRATA DOF: área impresa 5.161; se usa área calculada del diámetro"
      const mm2 = /mm2 impreso ([\d.]+)/.exec(nota);
      const area = /área impresa ([\d.]+)/.exec(nota);
      if (mm2) errata.push({ path: `rows[${i}].mm2`, asPublished: Number(mm2[1]), corrected: Number(r.mm2), reason: nota, approvedBy: VERIFICADO, approvedAt: FECHA });
      else if (area) errata.push({ path: `rows[${i}].area_aprox_mm2`, asPublished: Number(area[1]), corrected: Number(r.area_aprox_mm2), reason: nota, approvedBy: VERIFICADO, approvedAt: FECHA });
      else row.nota = nota;
    }
    return row;
  });
  if (t.filas.some((r) => typeof r.nota === "string" && !/impres/.test(r.nota)) && !keys.includes("nota")) keys.push("nota");
  const table = {
    id: `nom-001-sede-2012/${id}`,
    norm: { id: "nom-001-sede", edition: "2012" },
    reference: { table: t.referencia, article, title: t.descripcion },
    source: {
      document: SRC.file,
      sha256: SRC.sha256,
      publication: SRC.publication,
      pages: [t.pagina_pdf],
      method: "captura-usuario" as const,
      extractor: "Extracción entregada por el usuario (fuentes/nom-001-sede-2012-externa/tablas_NOM-001-SEDE-2012.json, tabla " + extId + "); valores copiados sin modificar",
    },
    notes: ["Los rangos se conservan como texto, como en la tabla publicada (p. ej. \"12-23\", \"43+\")."],
    errata,
    kind: "rows-table" as const,
    data: { columns: keys.map((k) => ({ key: k, label: k })), rows },
  };
  normTableSchema.parse(table);
  writeFileSync(`${DATA_DIR}nom-001-sede-2012/${id}.json`, `${JSON.stringify(table, null, 2)}\n`, "utf8");
  console.log(`✓ ${t.referencia.padEnd(24)} → ${id}.json  (${rows.length} renglones${errata.length ? `, ${errata.length} errata` : ""})`);
}
writeCatalogAndReport();
