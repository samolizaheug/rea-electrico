/**
 * Cotejo de las tablas NOM del proyecto contra la extracción externa del mismo PDF del DOF
 * (`fuentes/nom-001-sede-2012-externa/tablas_NOM-001-SEDE-2012.json`). Lo usan el script
 * `scripts/cotejar-nom-externa.ts` y las pruebas. No se exporta en `index.ts`: no forma parte
 * de la aplicación.
 */
import externa from "../fuentes/nom-001-sede-2012-externa/tablas_NOM-001-SEDE-2012.json";
import { getNormDataset } from "./index";

type Row = Record<string, unknown>;
export const tablasExternas = (externa as unknown as { tablas: Record<string, { referencia: string; pagina_pdf: number; filas: Row[] }> }).tablas;

export interface CotejoTabla {
  ours: string;
  theirs: string;
  compared: number;
  diffs: string[];
}

const nom = () => getNormDataset("nom-001-sede", "2012");
const d = (v: unknown) => String(v ?? "");
const same = (a: unknown, b: unknown) => (a === null || a === undefined ? b === null || b === undefined : typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : String(a) === String(b));

function cmp(out: CotejoTabla, where: string, ours: unknown, theirs: unknown) {
  out.compared++;
  if (!same(ours, theirs)) out.diffs.push(`${where}: proyecto=${d(ours) || "—"} externa=${d(theirs) || "—"}`);
}

function ampacity(ourId: string, theirId: string): CotejoTabla {
  const out: CotejoTabla = { ours: ourId, theirs: theirId, compared: 0, diffs: [] };
  const t = nom().table(ourId, "ampacity");
  for (const r of tablasExternas[theirId]!.filas) {
    const row = t.data.rows.find((x) => x.designation === d(r.awg_kcmil));
    if (!row) {
      out.diffs.push(`${d(r.awg_kcmil)}: renglón no está en el proyecto`);
      continue;
    }
    t.data.temperaturesC.forEach((c, i) => {
      cmp(out, `${row.designation} Cu ${c} °C`, row.cu[i], r[`cu_${c}C`]);
      cmp(out, `${row.designation} Al ${c} °C`, row.al[i], r[`al_${c}C`]);
    });
  }
  return out;
}

/** "10 o menos" → [null, 10]; "11-15" → [11, 15]; "71-75" → [71, 75]. */
function rangeOf(s: string): [number | null, number | null] {
  const m = /^(\d+)\s*o menos/.exec(s);
  if (m) return [null, Number(m[1])];
  const r = /^(\d+)\s*-\s*(\d+)/.exec(s);
  return r ? [Number(r[1]), Number(r[2])] : [Number.NaN, Number.NaN];
}

function tempCorrection(ourId: string, theirId: string): CotejoTabla {
  const out: CotejoTabla = { ours: ourId, theirs: theirId, compared: 0, diffs: [] };
  const t = nom().table(ourId, "temperature-correction");
  const ext = tablasExternas[theirId]!.filas;
  if (ext.length !== t.data.rows.length) out.diffs.push(`renglones: proyecto=${t.data.rows.length} externa=${ext.length}`);
  ext.forEach((r, i) => {
    const row = t.data.rows[i];
    if (!row) return;
    const [from, to] = rangeOf(d(r.temp_ambiente_C));
    cmp(out, `renglón ${i + 1} desde`, row.ambientFromC, from);
    cmp(out, `renglón ${i + 1} hasta`, row.ambientToC, to);
    t.data.temperaturesC.forEach((c, j) => cmp(out, `${d(r.temp_ambiente_C)} °C, ${c} °C`, row.factors[j], r[`cond_${c}C`]));
  });
  return out;
}

function adjustment(): CotejoTabla {
  const out: CotejoTabla = { ours: "tabla-310-15-b-3-a", theirs: "310-15b3a_ajuste_agrupamiento", compared: 0, diffs: [] };
  const t = nom().table("tabla-310-15-b-3-a", "adjustment-factors");
  tablasExternas[out.theirs]!.filas.forEach((r, i) => {
    const row = t.data.rows[i]!;
    const s = d(r.num_conductores_portadores);
    const from = Number(/^(\d+)/.exec(s)?.[1]);
    const to = s.endsWith("+") || /más|mas/.test(s) ? null : Number(/-(\d+)/.exec(s)?.[1]);
    cmp(out, `${s} desde`, row.conductorsFrom, from);
    cmp(out, `${s} hasta`, row.conductorsTo, to);
    cmp(out, `${s} %`, row.percent, r.porcentaje);
  });
  return out;
}

function ratings(): CotejoTabla {
  const out: CotejoTabla = { ours: "art-240-6-a", theirs: "240-6_capacidades_normalizadas_ocpd", compared: 0, diffs: [] };
  const t = nom().table("art-240-6-a", "standard-ratings").data;
  const ours = new Set([...t.inverseTimeA, ...t.additionalFuseA]);
  const theirs = new Set(tablasExternas[out.theirs]!.filas.map((r) => Number(r.A)));
  for (const v of new Set([...ours, ...theirs])) cmp(out, `${v} A`, ours.has(v) ? v : null, theirs.has(v) ? v : null);
  return out;
}

function egc(): CotejoTabla {
  const out: CotejoTabla = { ours: "tabla-250-122", theirs: "250-122_conductor_tierra_equipos", compared: 0, diffs: [] };
  const t = nom().table("tabla-250-122", "egc-size");
  tablasExternas[out.theirs]!.filas.forEach((r, i) => {
    const row = t.data.rows[i];
    if (!row) return out.diffs.push(`renglón ${r.ocpd_max_A} A no está en el proyecto`);
    cmp(out, `${r.ocpd_max_A} A protección`, row.maxRatingA, r.ocpd_max_A);
    cmp(out, `${r.ocpd_max_A} A Cu`, row.cu.designation, d(r.cu_awg));
    cmp(out, `${r.ocpd_max_A} A Al`, row.al?.designation ?? null, r.al_awg === null ? null : d(r.al_awg));
  });
  return out;
}

function motors(ourId: string, theirId: string, cols: [string, string, number][]): CotejoTabla {
  const out: CotejoTabla = { ours: ourId, theirs: theirId, compared: 0, diffs: [] };
  const t = nom().table(ourId, "motor-flc");
  for (const r of tablasExternas[theirId]!.filas) {
    const row = t.data.rows.find((x) => x.hp === d(r.hp).replace("-", " "));
    if (!row) {
      out.diffs.push(`${d(r.hp)} hp: renglón no está en el proyecto`);
      continue;
    }
    for (const [key, group, v] of cols) {
      const g = t.data.groups.find((x) => x.id === group)!;
      cmp(out, `${row.hp} hp ${key}`, row.currentsA[group]?.[g.voltagesV.indexOf(v)] ?? null, r[key]);
    }
  }
  return out;
}

function motorProtection(): CotejoTabla {
  const out: CotejoTabla = { ours: "tabla-430-52", theirs: "430-52_proteccion_max_motores_pct", compared: 0, diffs: [] };
  const t = nom().table("tabla-430-52", "motor-protection");
  const keys = ["fusible_sin_retardo_pct", "fusible_dos_elementos_pct", "interruptor_disparo_instantaneo_pct", "interruptor_tiempo_inverso_pct"];
  tablasExternas[out.theirs]!.filas.forEach((r, i) => {
    const row = t.data.rows[i];
    if (!row) return out.diffs.push(`renglón ${d(r.tipo_motor)} no está en el proyecto`);
    keys.forEach((k, j) => cmp(out, `${d(r.tipo_motor)} ${k}`, row.percents[j], r[k]));
  });
  return out;
}

function conduit(): CotejoTabla {
  const out: CotejoTabla = { ours: "cap10-tabla-4", theirs: "cap10-tabla4_dimensiones_tubo_conduit", compared: 0, diffs: [] };
  const t = nom().table("cap10-tabla-4", "raceway-dimensions");
  const ours = t.data.sections.flatMap((s) => s.rows.filter((r) => r.internalDiameterMm !== null).map((r) => ({ s, r })));
  const ext = tablasExternas[out.theirs]!.filas;
  if (ours.length !== ext.length) out.diffs.push(`renglones con datos: proyecto=${ours.length} externa=${ext.length}`);
  ext.forEach((x, i) => {
    const o = ours[i];
    if (!o) return;
    const w = `${o.s.id} ${o.r.metricDesignation}`;
    cmp(out, `${w} designación`, o.r.metricDesignation, x.designacion_metrica);
    cmp(out, `${w} Ø int`, o.r.internalDiameterMm, x.diametro_interno_mm);
    cmp(out, `${w} 100 %`, o.r.totalAreaMm2, x.area_100pct_mm2);
    cmp(out, `${w} 60 %`, o.r.area60Mm2, x.area_60pct_mm2);
    cmp(out, `${w} 53 %`, o.r.fill1Mm2, x.area_1cond_53pct_mm2);
    cmp(out, `${w} 31 %`, o.r.fill2Mm2, x.area_2cond_31pct_mm2);
    cmp(out, `${w} 40 %`, o.r.fillOver2Mm2, x.area_mas2cond_40pct_mm2);
  });
  return out;
}

function properties(): CotejoTabla {
  const out: CotejoTabla = { ours: "cap10-tabla-8", theirs: "cap10-tabla8_propiedades_conductores", compared: 0, diffs: [] };
  const t = nom().table("cap10-tabla-8", "conductor-properties");
  for (const x of tablasExternas[out.theirs]!.filas) {
    // De 18 a 8 AWG la tabla tiene dos renglones por calibre: alambre (1 hilo) y cable (7 hilos).
    const r = t.data.rows.find((y) => y.designation === d(x.awg_kcmil) && y.strands === x.num_hilos);
    if (!r) {
      out.diffs.push(`${d(x.awg_kcmil)} (${d(x.num_hilos)} hilos): renglón no está en el proyecto`);
      continue;
    }
    const w = `${r.designation} (${r.strands} hilos)`;
    cmp(out, `${w} área mm²`, r.areaMm2, x.area_mm2);
    cmp(out, `${w} cmil`, r.areaCmil, x.area_cmil);
    cmp(out, `${w} hilos`, r.strands, x.num_hilos);
    cmp(out, `${w} Ø hilo`, r.strandDiameterMm, x.diam_hilo_mm);
    cmp(out, `${w} Ø total`, r.overallDiameterMm, x.diam_total_mm);
    cmp(out, `${w} área total`, r.overallAreaMm2, x.area_total_mm2);
    cmp(out, `${w} R Cu`, r.dcResistanceOhmPerKm.cu, x.R_cc_75C_cu_desnudo_ohm_km);
    cmp(out, `${w} R Cu recubierto`, r.dcResistanceOhmPerKm.cuCoated, x.R_cc_75C_cu_recubierto_ohm_km);
    cmp(out, `${w} R Al`, r.dcResistanceOhmPerKm.al, x.R_cc_75C_al_ohm_km);
  }
  return out;
}

function impedance(): CotejoTabla {
  const out: CotejoTabla = { ours: "cap10-tabla-9", theirs: "cap10-tabla9_R_X_Z_ca_600V", compared: 0, diffs: [] };
  const t = nom().table("cap10-tabla-9", "ac-impedance");
  for (const x of tablasExternas[out.theirs]!.filas) {
    const r = t.data.rows.find((y) => y.designation === d(x.awg_kcmil));
    if (!r) {
      out.diffs.push(`${d(x.awg_kcmil)}: renglón no está en el proyecto`);
      continue;
    }
    const w = r.designation;
    cmp(out, `${w} XL PVC/Al`, r.xlOhmPerKm.pvcOAluminio, x.XL_pvc_o_al_ohm_km);
    cmp(out, `${w} XL acero`, r.xlOhmPerKm.acero, x.XL_acero_ohm_km);
    for (const [k, mat] of [
      ["R_cu", r.rCuOhmPerKm],
      ["R_al", r.rAlOhmPerKm],
      ["Zef085_cu", r.zCuOhmPerKm],
      ["Zef085_al", r.zAlOhmPerKm],
    ] as const)
      for (const c of ["pvc", "al", "acero"] as const) cmp(out, `${w} ${k} ${c}`, mat[c === "al" ? "aluminio" : c], x[`${k}_${c}`]);
  }
  return out;
}

function demand(ourId: string, theirId: string): CotejoTabla {
  const out: CotejoTabla = { ours: ourId, theirs: theirId, compared: 0, diffs: [] };
  const t = nom().table(ourId, "demand-factors");
  const ours = t.data.rows.flatMap((r) => r.tiers.map((x) => ({ label: r.label, upTo: x.upToVA, pct: x.percent })));
  const ext = tablasExternas[theirId]!.filas;
  if (ours.length !== ext.length) out.diffs.push(`tramos: proyecto=${ours.length} externa=${ext.length}`);
  ext.forEach((x, i) => {
    const o = ours[i];
    if (!o) return;
    cmp(out, `${o.label} tramo ${i + 1} hasta VA`, o.upTo, x.VA_hasta ?? null);
    cmp(out, `${o.label} tramo ${i + 1} %`, o.pct, x.factor_demanda_pct);
  });
  return out;
}

/** Todas las tablas que existen en ambas extracciones. */
export function compararConExterna(): CotejoTabla[] {
  return [
    ampacity("tabla-310-15-b-16", "310-15b16_ampacidad_canalizacion"),
    ampacity("tabla-310-15-b-17", "310-15b17_ampacidad_aire_libre"),
    tempCorrection("tabla-310-15-b-2-a", "310-15b2a_correccion_temp_30C"),
    tempCorrection("tabla-310-15-b-2-b", "310-15b2b_correccion_temp_40C"),
    adjustment(),
    ratings(),
    egc(),
    motors("tabla-430-248", "430-248_corriente_motores_monofasicos", [
      ["A_115V", "monofasico", 115],
      ["A_127V", "monofasico", 127],
      ["A_208V", "monofasico", 208],
      ["A_230V", "monofasico", 230],
    ]),
    motors("tabla-430-250", "430-250_corriente_motores_trifasicos", [
      ["A_115V", "induccion", 115],
      ["A_200V", "induccion", 200],
      ["A_208V", "induccion", 208],
      ["A_230V", "induccion", 230],
      ["A_460V", "induccion", 460],
      ["A_575V", "induccion", 575],
      ["A_2300V", "induccion", 2300],
      ["sinc_A_230V", "sincrono-fp1", 230],
      ["sinc_A_460V", "sincrono-fp1", 460],
      ["sinc_A_575V", "sincrono-fp1", 575],
      ["sinc_A_2300V", "sincrono-fp1", 2300],
    ]),
    motorProtection(),
    conduit(),
    properties(),
    impedance(),
    demand("tabla-220-42", "220-42_demanda_alumbrado"),
    demand("tabla-220-44", "220-44_demanda_contactos_no_vivienda"),
  ];
}
