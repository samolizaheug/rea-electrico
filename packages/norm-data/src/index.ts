/**
 * @rea/norm-data — acceso a las tablas normativas.
 *
 * Uso:
 *   const nom = getNormDataset("nom-001-sede", "2012");
 *   const t = nom.table("tabla-310-15-b-16", "ampacity");
 *   nom.status("tabla-310-15-b-16")  // { status: "por_verificar", ... }
 */
import { rawCatalog } from "./catalog";
import { fingerprint } from "./fingerprint";
import {
  normTableSchema,
  verificationFileSchema,
  type NormTable,
  type NormTableOf,
  type TableKind,
  type VerificationFile,
  type VerificationStatus,
} from "./schema";

export * from "./schema";
export * from "./nom-001-sede-2012";
export { canonicalJson, fingerprint, sha256Hex } from "./fingerprint";

export interface TableStatus {
  status: VerificationStatus;
  /** Explicación legible para la memoria de cálculo. */
  detail: string;
  by?: string;
  date?: string;
}

export class NormDataset {
  private readonly tables = new Map<string, NormTable>();

  constructor(
    readonly key: string,
    tables: NormTable[],
    readonly verification: VerificationFile,
  ) {
    for (const t of tables) this.tables.set(t.id.split("/")[1]!, t);
  }

  ids(): string[] {
    return [...this.tables.keys()].sort();
  }

  has(id: string): boolean {
    return this.tables.has(id);
  }

  /** Devuelve la tabla y, si se indica, verifica que sea del tipo esperado. */
  table<K extends TableKind>(id: string, kind: K): NormTableOf<K>;
  table(id: string): NormTable;
  table(id: string, kind?: TableKind): NormTable {
    const t = this.tables.get(id);
    if (!t) throw new Error(`${this.key}: no existe la tabla "${id}".`);
    if (kind && t.kind !== kind) throw new Error(`${this.key}/${id} es de tipo "${t.kind}", no "${kind}".`);
    return t;
  }

  /**
   * Cita de una tabla para la memoria de cálculo: referencia y página del PDF fuente,
   * p. ej. "NOM-001-SEDE-2012 Tabla 310-15(b)(16) (p. 170 del PDF)".
   */
  cite(id: string, label: string, suffix = ""): string {
    const t = this.table(id);
    return `${label} ${t.reference.table}${suffix} (p. ${t.source.pages.join(", ")} del PDF)`;
  }

  /** Referencia y páginas de una tabla (para guardar en resultados y reportes). */
  ref(id: string): { referencia: string; paginas: number[] } {
    const t = this.table(id);
    return { referencia: t.reference.table, paginas: t.source.pages };
  }

  /**
   * Estado de verificación vigente. Una verificación solo vale si la huella registrada
   * coincide con los datos actuales; si los datos cambiaron, la tabla vuelve a "por_verificar".
   */
  status(id: string): TableStatus {
    const t = this.table(id);
    const entry = this.verification.tables[id];
    if (!entry) return { status: "por_verificar", detail: `${t.reference.table}: pendiente de verificación por el usuario.` };
    if (entry.fingerprint !== fingerprint(t.data)) {
      return {
        status: "por_verificar",
        detail: `${t.reference.table}: los datos cambiaron después de la verificación del ${entry.date}; debe verificarse de nuevo.`,
      };
    }
    const label = entry.status === "verificado" ? "verificada" : entry.status === "fuente_secundaria" ? "tomada de fuente secundaria" : "pendiente de verificación";
    return { status: entry.status, detail: `${t.reference.table}: ${label} (${entry.by}, ${entry.date}).`, by: entry.by, date: entry.date };
  }
}

const cache = new Map<string, NormDataset>();

/** Conjuntos de datos disponibles, p. ej. ["nom-001-sede-2012"]. */
export function availableDatasets(): string[] {
  return Object.keys(rawCatalog).sort();
}

/** Carga (y valida) el conjunto de tablas de una norma y edición. */
export function getNormDataset(normId: string, edition: string): NormDataset {
  const key = `${normId}-${edition}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const raw = rawCatalog[key];
  if (!raw) throw new Error(`No hay tablas cargadas para ${normId} edición ${edition}.`);
  const tables = raw.tables.map((t, i) => {
    const parsed = normTableSchema.safeParse(t);
    if (!parsed.success) throw new Error(`${key}: la tabla #${i} no cumple el formato: ${parsed.error.message}`);
    return parsed.data as NormTable;
  });
  const ds = new NormDataset(key, tables, verificationFileSchema.parse(raw.verification));
  cache.set(key, ds);
  return ds;
}
