import type { ConductorDecision, DropEvaluator, NormSizing, ProtectionDecision, SizingCircuit, TraceStep } from "@rea/engine";
import { fmtNum } from "@rea/engine";
import { SRC, iecData } from "./calc";
import { iecMethod, type IecMethod } from "./methods";

/**
 * Dimensionamiento según IEC 60364 (datos de la fuente secundaria ABB, ver docs/01-revision-normativa.md §3).
 *
 * Protección contra sobrecarga (IEC 60364-4-43, 433.1, citada en ABB cap. 2.3):
 *   Ib ≤ In ≤ Iz  y  I2 ≤ 1.45·Iz.
 *   - Interruptores (IEC 60898: I2 = 1.45·In; IEC 60947-2: I2 = 1.3·In): basta In ≤ Iz.
 *   - Fusibles (I2 = 1.6·In): In ≤ 0.9·Iz.
 *   - Interruptor de disparo instantáneo (solo magnético, con relevador de sobrecarga en el arrancador):
 *     la sobrecarga la protege el relevador ajustado a Ib, por lo que se exige Iz ≥ Ib.
 *   IEC no aplica un 125 % a cargas continuas: Ib es la corriente de diseño del circuito.
 *
 * Conductor (el menor que cumple): Iz = I0 · k1 · k2 · n ≥ Ib, protección, y caída de tensión.
 *   - I0: Tabla 8 (aire, 30 °C) o Tabla 15 (método D, terreno 20 °C).
 *   - k1: Tabla 4 (aire) o Tabla 10 (terreno). Entre renglones se toma el de la temperatura inmediata superior (conservador).
 *   - k2: Tabla 5 según la disposición del método; n conductores agrupados = n/2 o n/3 circuitos (nota 5).
 * Conductor de protección: Tabla 2 del cap. 2.5 (IEC 60364-5-54): S ≤ 16 → S; ≤ 35 → 16; > 35 → S/2.
 */

const STD = () => iecData().table("capacidades-interruptores", "standard-ratings").data.inverseTimeA;
const n = (v: unknown, fb = NaN) => (typeof v === "number" ? v : fb);
const A = (v: number) => `${fmtNum(v, 2)} A`;
const sizeLabel = (s: number) => String(s);
const nextStd = (x: number) => STD().find((s) => s >= x - 1e-9);
const isFuse = (t: string) => t.startsWith("fusible");

// ---------------------------------------------------------------- Protección

function protection(c: SizingCircuit): ProtectionDecision {
  const steps: TraceStep[] = [];
  const issues: ProtectionDecision["issues"] = [];
  const deviceType = String(c.breaker?.params.deviceType ?? "itm");
  const forced = c.breaker ? n(c.breaker.params.forcedRatingA) : NaN;
  const trafos = c.items.filter((i) => i.kind === "transformador");

  let ib = 0;
  if (c.items.length === 1 && trafos.length === 1) {
    const t = trafos[0]!.transformer!;
    if (t.primaryV > 1000) issues.push({ severity: "error", message: `${trafos[0]!.tag}: primario de más de 1000 V; la media tensión está fuera del alcance de IEC 60364 y de la fase 1.` });
    ib = t.ratedPrimaryA;
    steps.push({ label: "Corriente de diseño Ib: corriente nominal del primario", formula: c.m === 3 ? "Ib = Sn / (√3 · V)" : "Ib = Sn / V", substitution: `Ib = ${fmtNum(t.sn, 0)} / ${c.m === 3 ? `(√3 · ${fmtNum(t.primaryV, 0)})` : fmtNum(t.primaryV, 0)}`, result: A(ib) });
    issues.push({ severity: "info", message: `${trafos[0]!.tag}: verifique que la protección soporte la corriente de energización del transformador (dato del fabricante).` });
  } else {
    for (const i of c.items) {
      const a = i.kind === "motor" ? i.motor!.flcA : i.kind === "variador" ? i.vfd!.inputA : i.kind === "transformador" ? i.transformer!.ratedPrimaryA : i.amps;
      const src = i.kind === "motor" ? i.motor!.flcSource : i.kind === "variador" ? i.vfd!.inputSource : i.kind === "transformador" ? "corriente nominal del primario" : "carga con su factor de demanda";
      ib += a;
      steps.push({ label: `${i.tag}: corriente`, result: `${A(a)} (${src})` });
    }
    steps.push({ label: "Corriente de diseño del circuito", formula: "Ib = Σ I", result: A(ib), refs: [`${SRC}: IEC 60364-4-43 433.1 (Ib); sin factor de 125 % para cargas continuas`] });
  }

  const magneticOnly = deviceType === "instantaneo";
  const fuse = isFuse(deviceType);
  let ratingA = nextStd(ib);
  steps.push({
    label: "Corriente nominal del dispositivo",
    formula: "In ≥ Ib (valor de la serie de producto inmediato superior)",
    substitution: `Ib = ${A(ib)}`,
    result: ratingA !== undefined ? `${ratingA} A` : "sin valor en la serie",
    refs: [`${SRC}: series de In de interruptores ABB (MCB curva C, Tmax T3, T5-T6, T7)`, "IEC 60364 no fija capacidades normalizadas; en interruptores ajustables In es la corriente de ajuste."],
  });
  if (magneticOnly) steps.push({ label: "Interruptor de disparo instantáneo", result: "La sobrecarga la protege el relevador del arrancador ajustado a Ib; el ajuste magnético se elige por coordinación con el arrancador (tablas del fabricante)." });
  if (fuse) issues.push({ severity: "info", message: `${c.breaker?.tag ?? c.tag}: la serie de capacidades es de interruptores ABB; confirme la capacidad comercial del fusible (IEC 60269).` });

  if (!c.breaker) {
    ratingA = undefined;
    issues.push({ severity: c.transformerSecondary ? "warning" : "info", message: `${c.tag}: no tiene dispositivo de protección en su origen; no se verifica Ib ≤ In ≤ Iz (IEC 60364-4-43).` });
  } else if (Number.isFinite(forced)) {
    ratingA = forced;
    steps.push({ label: `${c.breaker.tag}: corriente nominal fijada por el usuario`, result: `${forced} A` });
    if (forced < ib - 1e-9) issues.push({ severity: "error", message: `${c.breaker.tag}: In = ${forced} A es menor que Ib = ${A(ib)} (IEC 60364-4-43, 433.1).` });
  } else if (ratingA === undefined) {
    issues.push({ severity: "error", message: `${c.tag}: Ib = ${A(ib)} excede la serie de capacidades registrada (hasta ${STD().at(-1)} A); considere conductores y protecciones en paralelo o fije la protección.` });
  }
  const rule = `IEC 60364-4-43 433.1: Ib ≤ In ≤ ${fuse ? "0.9·Iz (fusible)" : "Iz"}`;
  return { designA: ib, loadA: ib, rule, ratingA, protectsConductor: !magneticOnly, nextHigherAllowed: false, steps, issues };
}

// ---------------------------------------------------------------- Factores

/** Factor de una tabla de temperatura: renglón exacto o el de temperatura inmediata superior. */
function temperatureFactor(id: string, refC: number, ambientC: number, insulation: "PVC" | "XLPE"): { k: number; row: string } | { error: string } {
  if (Math.abs(ambientC - refC) < 1e-9) return { k: 1, row: `${refC} °C (referencia)` };
  const t = iecData().table(id, "factor-table");
  const col = t.data.columns.findIndex((c) => c.id === insulation);
  const rows = t.data.rows.map((r) => ({ c: Number(r.key), v: r.values[col] ?? null }));
  const pick = ambientC < refC ? rows.filter((r) => r.c < refC && r.c >= ambientC - 1e-9)[0] ?? rows.find((r) => r.c < refC) : rows.find((r) => r.c >= ambientC - 1e-9 && r.c > refC);
  if (!pick || pick.v === null) return { error: `${t.reference.table} no da factor para ${insulation} a ${ambientC} °C (la fuente remite al fabricante).` };
  return { k: pick.v, row: pick.c === ambientC ? `${pick.c} °C` : `${pick.c} °C (temperatura inmediata superior de la tabla, conservador)` };
}

function groupingFactor(m: IecMethod, circuits: number): { k: number; why: string; warn?: string } {
  if (m.grouping === null) return { k: 1, why: "cables separados (método G): sin factor de agrupamiento (nota 2 de la Tabla 5)" };
  if (circuits <= 1) return { k: 1, why: "un solo circuito" };
  const t = iecData().table("tabla-5-agrupamiento", "factor-table");
  const row = t.data.rows.find((r) => r.key === m.grouping)!;
  const counts = t.data.columns.map((c) => Number(c.id));
  let j = counts.findIndex((c, i) => c >= circuits && row.values[i] !== null);
  let warn: string | undefined;
  if (j < 0) {
    const lastIdx = row.values.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).at(-1)!;
    j = lastIdx;
    if (m.grouping === "1") warn = `${circuits} circuitos agrupados exceden la Tabla 5 (máximo 20); se usa el factor de 20 circuitos.`;
  }
  const k = row.values[j]!;
  return { k, why: `disposición ${row.key} (${row.label.toLowerCase()}), ${circuits} circuitos → columna de ${counts[j]}${m.grouping !== "1" && circuits > 9 ? " (sin reducción adicional después de 9)" : ""}`, warn };
}

// ---------------------------------------------------------------- Conductor

interface Candidate {
  size: number;
  i0: number;
  iz: number;
}

function conductor(c: SizingCircuit, p: ProtectionDecision, drop: DropEvaluator): ConductorDecision {
  const steps: TraceStep[] = [];
  const issues: ConductorDecision["issues"] = [];
  const material = c.params.material === "Al" ? "Al" : "Cu";
  const npar = Math.max(1, n(c.params.conductorsPerPhase, 1));
  const m = iecMethod(c.params.installationMethod);
  const fail = (msg: string): ConductorDecision => {
    issues.push({ severity: "error", message: `${c.tag}: ${msg}` });
    return { designation: "—", system: "mm2", areaMm2: 0, conductorsPerPhase: npar, material, ampacityA: 0, governing: "ampacidad", dropPct: NaN, steps, issues };
  };
  if (!m) return fail("método de instalación no reconocido para IEC 60364; elija uno de la lista (A1 … G).");
  if (c.vNomLL > 1000) return fail("circuitos de más de 1000 V están fuera del alcance de IEC 60364 (baja tensión).");
  const ins = c.params.insulationType === "XLPE" ? "XLPE" : c.params.insulationType === "PVC" ? "PVC" : null;
  if (!ins) return fail(`aislamiento "${String(c.params.insulationType)}" no es válido en IEC; elija PVC o XLPE/EPR.`);

  // ---- Columna de la tabla de ampacidad.
  const loaded = c.m === 1 ? 2 : 3;
  const buried = m.method === "D";
  const amp = iecData().table(buried ? "ampacidad-terreno" : "ampacidad-aire", "iec-ampacity");
  const arrangement = m.method === "F" ? (loaded === 2 ? "contacto" : m.arrangement) : m.arrangement;
  const col = amp.data.columns.find((x) => x.method === m.method && x.material === material && x.insulation === ins && x.loadedConductors === loaded && (x.arrangement ?? undefined) === (arrangement ?? undefined));
  if (!col) return fail(`la tabla no da valores para el método ${m.method} con ${loaded} conductores cargados${m.method === "G" ? " (el método G solo tiene circuitos trifásicos)" : ""}.`);
  steps.push({
    label: "Método de instalación y columna de ampacidad",
    substitution: `${m.label} (Tabla 3, ítem ${m.items}); ${material}, ${ins === "XLPE" ? "XLPE/EPR" : "PVC"}, ${loaded} conductores cargados${arrangement ? `, ${arrangement}` : ""}`,
    result: `${amp.reference.table}, método ${m.method}`,
    refs: [`${SRC}: ${amp.reference.table}`, `Referencia: ${amp.data.reference.medium} a ${amp.data.reference.temperatureC} °C`],
  });
  if (c.items.some((i) => i.nonLinear) && c.system === "3F4H") issues.push({ severity: "info", message: `${c.tag}: cargas no lineales; si hay corrientes armónicas de 3.er orden en el neutro, aplique los factores de la Tabla 16 de la fuente (aún no se aplican).` });

  // ---- k1: temperatura.
  const kt = temperatureFactor(buried ? "tabla-10-temperatura-terreno" : "tabla-4-temperatura-aire", amp.data.reference.temperatureC, c.ambientC, ins);
  if ("error" in kt) return fail(kt.error);
  steps.push({ label: `Factor k1 por temperatura ${buried ? "del terreno" : "ambiente"}`, substitution: `${c.ambientC} °C (${c.ambientSource}) → renglón ${kt.row}`, result: `k1 = ${kt.k}`, refs: [`${SRC}: ${buried ? "Tabla 10" : "Tabla 4"}`] });

  // ---- k2: agrupamiento (nota 5: n unipolares = n/2 o n/3 circuitos).
  const grouped = n(c.params.groupedConductors);
  const circuits = Number.isFinite(grouped) ? Math.ceil(grouped / loaded) : 1;
  const kg = groupingFactor(m, circuits);
  if (kg.warn) issues.push({ severity: "warning", message: `${c.tag}: ${kg.warn}` });
  steps.push({
    label: "Factor k2 por agrupamiento",
    substitution: `${Number.isFinite(grouped) ? `${grouped} conductores cargados / ${loaded} = ${circuits} circuito(s) (nota 5 de la Tabla 5); ` : ""}${kg.why}`,
    result: `k2 = ${kg.k}`,
    refs: [`${SRC}: Tabla 5`],
  });
  if (buried)
    issues.push({
      severity: "warning",
      message: `${c.tag}: método D con la Tabla 15 de la edición 2001. La edición 2009 de IEC 60364-5-52 (método D1, ductos enterrados) da ampacidades iguales o menores, hasta 8.5 % menores según su reproducción en fuentes secundarias; verifique la sección con la edición vigente.`,
    });
  if (buried) steps.push({ label: "Instalación enterrada (método D)", result: "k2' (ductos adyacentes, Tablas 12–13) = 1 y k3 (resistividad del suelo 2.5 K·m/W, Tabla 14) = 1: supuestos de la herramienta; verifique si hay otros ductos cercanos o un suelo de mayor resistividad." });
  const ktot = kt.k * kg.k;

  // ---- Candidatos (con R y X disponibles para la caída de tensión).
  const imp = iecData().table(material === "Cu" ? "tabla-1-impedancia-cu" : "tabla-2-impedancia-al", "cable-impedance");
  const candidates: Candidate[] = [];
  amp.data.sizesMm2.forEach((s, i) => {
    const i0 = col.values[i];
    if (i0 === null || i0 === undefined) return;
    if (!imp.data.rows.some((r) => r.sizeMm2 === s)) return;
    candidates.push({ size: s, i0, iz: i0 * ktot * npar });
  });
  if (!candidates.length) return fail("no hay secciones disponibles para estas condiciones.");

  const fuse = isFuse(String(c.breaker?.params.deviceType ?? ""));
  const check = (cand: Candidate) => {
    const reasons: string[] = [];
    let byProtection = false;
    if (cand.iz < p.designA - 1e-9) reasons.push(`Iz = ${A(cand.iz)} < Ib = ${A(p.designA)}`);
    if (p.protectsConductor && p.ratingA !== undefined) {
      const lim = fuse ? 0.9 * cand.iz : cand.iz;
      if (p.ratingA > lim + 1e-9) {
        reasons.push(`In = ${p.ratingA} A > ${fuse ? `0.9·Iz = ${A(lim)}` : `Iz = ${A(cand.iz)}`} (433.1)`);
        byProtection = true;
      }
    }
    return { ok: reasons.length === 0, reasons, byProtection };
  };
  const line = (cand: Candidate) => `${sizeLabel(cand.size)} mm²${npar > 1 ? ` × ${npar}` : ""}: I0 = ${fmtNum(cand.i0, 1)} A · k1 ${kt.k} · k2 ${kg.k}${npar > 1 ? ` · ${npar}` : ""} = Iz ${A(cand.iz)}`;

  const forcedSize = typeof c.params.forcedSize === "string" ? Number(c.params.forcedSize) : NaN;
  let chosen: Candidate;
  let governing: ConductorDecision["governing"];
  if (Number.isFinite(forcedSize)) {
    const cand = candidates.find((x) => x.size === forcedSize);
    if (!cand) return fail(`la sección fijada ${c.params.forcedSize} mm² no está disponible en estas condiciones.`);
    const r = check(cand);
    steps.push({ label: "Verificación de la sección fijada", substitution: line(cand), result: r.ok ? "Cumple Ib ≤ In ≤ Iz" : `No cumple: ${r.reasons.join("; ")}`, refs: [`${SRC}: IEC 60364-4-43 433.1`] });
    for (const reason of r.reasons) issues.push({ severity: "error", message: `${c.tag}: sección ${c.params.forcedSize} mm² — ${reason}.` });
    chosen = cand;
    governing = "fijado";
  } else {
    let firstAmp: Candidate | undefined;
    let found: Candidate | undefined;
    for (const cand of candidates) {
      const r = check(cand);
      if (!firstAmp && (r.ok || r.byProtection) && cand.iz >= p.designA - 1e-9) firstAmp = cand;
      if (r.ok) {
        found = cand;
        break;
      }
    }
    if (!found) return fail(`ninguna sección (hasta ${candidates.at(-1)!.size} mm²${npar > 1 ? ` × ${npar}` : ""}) cumple; considere conductores en paralelo.`);
    governing = firstAmp && firstAmp !== found ? "proteccion" : "ampacidad";
    steps.push({ label: "Sección mínima por ampacidad y protección", formula: `Iz = I0 · k1 · k2 · n ≥ Ib ; In ≤ ${fuse ? "0.9·Iz" : "Iz"}`, substitution: line(found), result: `${sizeLabel(found.size)} mm²`, refs: [`${SRC}: ${amp.reference.table}`, "IEC 60364-4-43 433.1"] });
    chosen = found;
  }

  // ---- Caída de tensión: se aumenta la sección hasta cumplir.
  let dr = drop(sizeLabel(chosen.size), npar);
  if ("error" in dr) return fail(dr.error);
  if (!Number.isFinite(forcedSize)) {
    let idx = candidates.indexOf(chosen);
    while (dr.pct > dr.limitPct + 1e-9 && idx < candidates.length - 1) {
      idx++;
      const next = drop(sizeLabel(candidates[idx]!.size), npar);
      if ("error" in next) return fail(next.error);
      dr = next;
      chosen = candidates[idx]!;
      governing = "caida-de-tension";
    }
  }
  steps.push({ label: "Caída de tensión con la sección elegida", result: `${fmtNum(dr.pct, 3)} % ${dr.pct <= dr.limitPct + 1e-9 ? "≤" : ">"} ${dr.limitPct} % (${dr.limitSource})` });
  if (dr.pct > dr.limitPct + 1e-9) issues.push({ severity: "error", message: `${c.tag}: caída de tensión ${fmtNum(dr.pct, 2)} % > ${dr.limitPct} % (${dr.limitSource})${Number.isFinite(forcedSize) ? " con la sección fijada" : "; ni la mayor sección con datos de impedancia cumple, considere conductores en paralelo"}.` });
  if (governing === "caida-de-tension") steps.push({ label: "Sección aumentada por caída de tensión", result: `${sizeLabel(chosen.size)} mm²` });

  // ---- Conductor de protección (IEC 60364-5-54, Tabla 2 del cap. 2.5 de la fuente).
  let egc: ConductorDecision["egc"];
  if (c.params.includeEgc !== false) {
    const t = iecData().table("tabla-2-conductor-proteccion", "pe-size");
    const s = chosen.size;
    const rule = t.data.rows.find((r) => (r.phaseAboveMm2 === null || s > r.phaseAboveMm2) && (r.phaseUpToMm2 === null || s <= r.phaseUpToMm2))!;
    const need = rule.sameMaterial === "S" ? s : rule.sameMaterial === "S/2" ? s / 2 : rule.sameMaterial;
    const pe = amp.data.sizesMm2.find((x) => x >= need - 1e-9) ?? s;
    egc = { designation: sizeLabel(pe), system: "mm2", areaMm2: pe, perRaceway: npar > 1 };
    steps.push({
      label: "Conductor de protección (PE)",
      substitution: `S = ${sizeLabel(s)} mm² → ${rule.publishedText}${rule.sameMaterial === "S/2" ? ` = ${fmtNum(need, 1)} mm² → sección comercial ${sizeLabel(pe)} mm²` : ""}`,
      result: `${sizeLabel(pe)} mm² ${material}${npar > 1 ? " en cada circuito en paralelo (criterio de la herramienta)" : ""}`,
      refs: [`${SRC}: cap. 2.5, Tabla 2 (IEC 60364-5-54, 543.1)`, "Mismo material que el conductor de línea."],
    });
  }

  return { designation: sizeLabel(chosen.size), system: "mm2", areaMm2: chosen.size, conductorsPerPhase: npar, material, ampacityA: chosen.iz, governing, dropPct: dr.pct, egc, steps, issues };
}

export const iecSizing: NormSizing = { protection, conductor };
