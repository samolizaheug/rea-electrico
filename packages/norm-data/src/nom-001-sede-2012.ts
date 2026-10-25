/**
 * Consultas tipadas a las tablas de la NOM-001-SEDE-2012 que se guardan como renglones
 * (`rows-table`). Cada resultado lleva la referencia de la tabla y la página del PDF del DOF,
 * para la memoria de cálculo. La lógica de cálculo usa estas funciones, no los JSON directos.
 */
import { getNormDataset } from "./index";

const ds = () => getNormDataset("nom-001-sede", "2012");

/** Referencia a la tabla usada: se guarda junto a cada resultado. */
export interface CitaNom {
  referencia: string;
  paginas: number[];
  /** Texto para la memoria: "NOM-001-SEDE-2012 Tabla 250-66 (p. 122 del PDF)". */
  texto: string;
}

export type ConCita<T> = T & { cita: CitaNom };

export function citaNom(id: string): CitaNom {
  const r = ds().ref(id);
  return { ...r, texto: ds().cite(id, "NOM-001-SEDE-2012") };
}

type Cell = number | string | null | undefined;
function rows(id: string): Record<string, Cell>[] {
  return ds().table(id, "rows-table").data.rows;
}

/** Número o rango publicado como texto: 5 → [5,5]; "12-23" → [12,23]; "43+" / "6+" → [43,∞]; "1-4" → [1,4]. */
export function rango(v: Cell): [number, number] {
  if (typeof v === "number") return [v, v];
  const s = String(v ?? "").trim();
  const plus = /^(\d+(?:\.\d+)?)\s*\+$/.exec(s);
  if (plus) return [Number(plus[1]), Infinity];
  const r = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (r) return [Number(r[1]), Number(r[2])];
  const gt = /^>\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (gt) return [Number(gt[1]), Infinity];
  const n = Number(s);
  return Number.isFinite(n) ? [n, n] : [Number.NaN, Number.NaN];
}
const enRango = (v: Cell, x: number) => {
  const [a, b] = rango(v);
  return x >= a - 1e-9 && x <= b + 1e-9;
};

// ---------------------------------------------------------------- 240-4(d)

/**
 * Protección máxima de conductores pequeños de cobre, 240-4(d). El DOF solo publica los incisos de
 * cobre (1), (2), (3), (5) y (7); para otros calibres o aluminio devuelve null.
 */
export function proteccionMaxConductorPequeno(designacionAwg: string): ConCita<{ maxA: number; condicion: string | null }> | null {
  const r = rows("art-240-4-d").find((x) => String(x.awg) === designacionAwg);
  if (!r) return null;
  return { maxA: Number(r.ocpd_max_A), condicion: typeof r.condicion === "string" ? r.condicion : null, cita: citaNom("art-240-4-d") };
}

// ---------------------------------------------------------------- 250-66

/**
 * Conductor del electrodo de puesta a tierra (Tabla 250-66) según el área del mayor conductor de
 * acometida (o equivalente de conductores en paralelo) de cobre, en mm².
 */
export function conductorElectrodoTierra(areaAcometidaCuMm2: number): ConCita<{ cu: string; cuMm2: number; al: string; alMm2: number }> {
  const t = rows("tabla-250-66");
  const r =
    t.find((x, i) => {
      const hasta = x.acometida_cu_hasta_mm2;
      const desde = Number(x.acometida_cu_desde_mm2 ?? 0);
      return (hasta === null || areaAcometidaCuMm2 <= Number(hasta) + 1e-9) && (i === 0 || areaAcometidaCuMm2 > desde - 1e-9);
    }) ?? t.at(-1)!;
  return { cu: String(r.gec_cu_awg), cuMm2: Number(r.gec_cu_mm2), al: String(r.gec_al_awg), alMm2: Number(r.gec_al_mm2), cita: citaNom("tabla-250-66") };
}

// ---------------------------------------------------------------- Cargas (Art. 220)

/** Carga mínima de alumbrado general por tipo de inmueble (Tabla 220-12), VA/m². */
export function cargaAlumbradoVAm2(tipoInmueble: string): ConCita<{ vaPorM2: number; nota: string | null }> | null {
  const r = rows("tabla-220-12").find((x) => String(x.tipo_inmueble).toLowerCase() === tipoInmueble.toLowerCase());
  return r ? { vaPorM2: Number(r.VA_por_m2), nota: typeof r.nota === "string" ? r.nota : null, cita: citaNom("tabla-220-12") } : null;
}

export function tiposInmueble220_12(): string[] {
  return rows("tabla-220-12").map((r) => String(r.tipo_inmueble));
}

/** Factor de demanda de secadoras domésticas (Tabla 220-54), incluidas las reglas de 12-23 y 24-42. */
export function demandaSecadoras(n: number): ConCita<{ pct: number }> {
  if (n >= 12 && n <= 23) return { pct: 47 - (n - 11), cita: citaNom("tabla-220-54") };
  if (n >= 24 && n <= 42) return { pct: 35 - 0.5 * (n - 23), cita: citaNom("tabla-220-54") };
  const r = rows("tabla-220-54").find((x) => enRango(x.num_secadoras, n));
  if (!r || r.factor_demanda_pct === null) throw new Error(`Tabla 220-54: sin factor para ${n} secadoras.`);
  return { pct: Number(r.factor_demanda_pct), cita: citaNom("tabla-220-54") };
}

/**
 * Tabla 220-55: factores de las columnas A (< 3.5 kW) y B (3.5 a 8.75 kW) y demanda máxima de la
 * columna C (kW, estufas de hasta 12 kW), incluidas las fórmulas de 26 aparatos en adelante.
 */
export function demandaEstufas(n: number): ConCita<{ colAPct: number; colBPct: number; colCkW: number }> {
  const r = rows("tabla-220-55").find((x) => enRango(x.num_aparatos, n));
  if (!r) throw new Error(`Tabla 220-55: sin renglón para ${n} aparatos.`);
  const c = r["colC_demanda_max_kW_hasta_12kW"];
  let colCkW: number;
  if (typeof c === "number") colCkW = c;
  else if (n >= 26 && n <= 40) colCkW = 15 + 1 * n; // "15 kW + 1 kW por cada estufa"
  else colCkW = 25 + 0.75 * n; // "25 kW + ¾ kW por cada estufa"
  return { colAPct: Number(r["colA_pct_menos_3.5kW"]), colBPct: Number(r["colB_pct_3.5_a_8.75kW"]), colCkW, cita: citaNom("tabla-220-55") };
}

/** Factor de demanda de equipo de cocina no residencial (Tabla 220-56). */
export function demandaCocinaNoVivienda(n: number): ConCita<{ pct: number }> {
  const r = rows("tabla-220-56").find((x) => enRango(x.num_equipos, n));
  if (!r) throw new Error(`Tabla 220-56: sin renglón para ${n} equipos.`);
  return { pct: Number(r.factor_demanda_pct), cita: citaNom("tabla-220-56") };
}

/** Método opcional para multifamiliares de 3 o más viviendas (Tabla 220-84). */
export function demandaMultifamiliar(viviendas: number): ConCita<{ pct: number }> {
  const r = rows("tabla-220-84").find((x) => enRango(x.num_viviendas, viviendas));
  if (!r) throw new Error(`Tabla 220-84: aplica a 3 o más viviendas (${viviendas}).`);
  return { pct: Number(r.factor_demanda_pct), cita: citaNom("tabla-220-84") };
}

/** Método opcional para escuelas (Tabla 220-86): carga con demanda, en VA/m², por tramos. */
export function demandaEscuelasVAm2(cargaVAm2: number): ConCita<{ demandaVAm2: number; pasos: string[] }> {
  let rest = cargaVAm2;
  let total = 0;
  const pasos: string[] = [];
  for (const r of rows("tabla-220-86")) {
    const desde = Number(r.VA_m2_desde);
    const hasta = r.VA_m2_hasta === null ? Infinity : Number(r.VA_m2_hasta);
    const tramo = Math.max(0, Math.min(rest, hasta - desde));
    if (tramo <= 0) continue;
    const pct = Number(r.factor_demanda_pct);
    total += (tramo * pct) / 100;
    pasos.push(`${tramo.toFixed(1)} VA/m² × ${pct} %`);
    rest -= tramo;
  }
  return { demandaVAm2: total, pasos, cita: citaNom("tabla-220-86") };
}

/** Método opcional para restaurantes nuevos (Tabla 220-88): carga permitida del alimentador, kVA. */
export function cargaRestaurante(kVAConectados: number, todoElectrico: boolean): ConCita<{ kVA: number; formula: string }> {
  // Renglones como intervalos continuos (límite anterior, límite superior]: 0-200, 201-325, 326-800, >800.
  const r = rows("tabla-220-88").find((x) => kVAConectados <= rango(x.kVA_conectados)[1]);
  if (!r) throw new Error(`Tabla 220-88: sin renglón para ${kVAConectados} kVA.`);
  const formula = String(todoElectrico ? r.todo_electrico : r.electrico_y_no_electrico);
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(formula);
  const f = /^(\d+(?:\.\d+)?)% de \(kVA-(\d+)\) \+ (\d+(?:\.\d+)?)$/.exec(formula);
  const kVA = pct ? (kVAConectados * Number(pct[1])) / 100 : f ? (Number(f[1]) / 100) * (kVAConectados - Number(f[2])) + Number(f[3]) : Number.NaN;
  return { kVA, formula, cita: citaNom("tabla-220-88") };
}

// ---------------------------------------------------------------- Capítulo 10 (tubería)

/** Porcentaje máximo de llenado de tubo conduit (Capítulo 10, Tabla 1). */
export function llenadoMaxPct(numConductores: number): ConCita<{ pct: number }> {
  const r = rows("cap10-tabla-1").find((x) => enRango(x.num_conductores, numConductores) || (String(x.num_conductores).endsWith("+") && numConductores >= rango(x.num_conductores)[0]));
  if (!r) throw new Error(`Capítulo 10, Tabla 1: sin renglón para ${numConductores} conductores.`);
  return { pct: Number(r.porcentaje_max), cita: citaNom("cap10-tabla-1") };
}

/** Diámetro y área aproximados de un conductor aislado (Capítulo 10, Tabla 5). `tipo`: texto que aparece en la columna de tipo, p. ej. "THHN". */
export function dimensionConductor(tipo: string, designacion: string): ConCita<{ tipoPublicado: string; diametroMm: number; areaMm2: number }> | null {
  const t = tipo.toUpperCase();
  const r = rows("cap10-tabla-5").find((x) => String(x.awg_kcmil) === designacion && String(x.tipo_aislamiento).toUpperCase().split(/[\s,()]+/).includes(t));
  return r ? { tipoPublicado: String(r.tipo_aislamiento), diametroMm: Number(r.diametro_aprox_mm), areaMm2: Number(r.area_aprox_mm2), cita: citaNom("cap10-tabla-5") } : null;
}
