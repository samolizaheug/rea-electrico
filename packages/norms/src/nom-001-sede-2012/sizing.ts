import type { ConductorDecision, DropEvaluator, NormSizing, ProtectionDecision, SizingCircuit, TraceStep } from "@rea/engine";
import { fmtNum } from "@rea/engine";
import { getNormDataset } from "@rea/norm-data";
import { racewayMethod } from "./raceways";

/**
 * Dimensionamiento según la NOM-001-SEDE-2012.
 *
 * Protección (se resuelve primero, de aguas abajo hacia la fuente):
 * - Circuitos generales: 210-20(a) / 215-3 (no continua + 125 % continua), valor de 240-6(a).
 * - Motor individual: 430-52 y Tabla 430-52; si el valor no es estándar, el inmediato superior (430-52(c)(1) Exc. 1).
 * - Alimentador de motores: 430-62(a) y 430-63 (no mayor que la mayor protección de derivado + demás corrientes).
 * - Variador: 430-122(a) para el conductor; protección según el fabricante (430-130), se propone el valor estándar ≥ 125 %.
 * - Transformador ≤ 600 V: 450-3(b), protección del primario solamente.
 *
 * Conductor (el menor calibre que cumple todo):
 * 1. Ampacidad de la Tabla 310-15(b)(16)/(17) en la columna de terminales ≥ corriente de diseño
 *    (210-19(a)(1), 215-2(a)(1), 430-22, 430-24, 430-122; 110-14(c)).
 * 2. Ampacidad corregida por temperatura (310-15(b)(2)(a)) y agrupamiento (310-15(b)(3)(a), 376-22(b), 392-80),
 *    limitada a la de terminales, ≥ carga (o ≥ diseño en circuitos de motor).
 * 3. Protegido por su dispositivo (240-4, salvo circuitos de motor: 240-4(g)).
 * 4. Caída de tensión ≤ límite (se aumenta el calibre si hace falta).
 * Conductor de puesta a tierra: 250-122, con aumento proporcional (b) y uno por canalización en paralelo (f).
 */

const data = () => getNormDataset("nom-001-sede", "2012");
const STD = () => data().table("art-240-6-a", "standard-ratings").data.inverseTimeA;
const n = (v: unknown, fb = NaN) => (typeof v === "number" ? v : fb);
const A = (v: number) => `${fmtNum(v, 2)} A`;

function nextStd(x: number): number | undefined {
  return STD().find((s) => s >= x - 1e-9);
}
function maxStdAtMost(x: number): number | undefined {
  return [...STD()].reverse().find((s) => s <= x + 1e-9);
}

// ---------------------------------------------------------------- Protección

function protection(c: SizingCircuit): ProtectionDecision {
  const steps: TraceStep[] = [];
  const issues: ProtectionDecision["issues"] = [];
  const motors = c.items.filter((i) => i.kind === "motor" || i.kind === "variador");
  const loads = c.items.filter((i) => i.kind === "carga");
  const trafos = c.items.filter((i) => i.kind === "transformador");
  const forced = c.breaker ? n(c.breaker.params.forcedRatingA) : NaN;
  const deviceType = String(c.breaker?.params.deviceType ?? "itm");
  let d: Omit<ProtectionDecision, "steps" | "issues" | "ratingA"> & { ratingA?: number; maxA?: number; maxRule?: string };
  let general = false;

  if (c.items.length === 1 && trafos.length === 1) {
    // ---- Alimentador de un transformador: 450-3(b), protección del primario solamente.
    const t = trafos[0]!.transformer!;
    const ip = t.ratedPrimaryA;
    if (t.primaryV > 600) issues.push({ severity: "error", message: `${trafos[0]!.tag}: primario de más de 600 V; la protección y los conductores de media tensión (450-3(a), 310-60) están fuera del alcance de la fase 1.` });
    steps.push({ label: "Corriente nominal del primario", formula: c.m === 3 ? "I = Sn / (√3 · V)" : "I = Sn / V", substitution: `I = ${fmtNum(t.sn, 0)} / ${c.m === 3 ? `(√3 · ${fmtNum(t.primaryV, 0)})` : fmtNum(t.primaryV, 0)}`, result: A(ip) });
    const pct = ip >= 9 ? 125 : ip >= 2 ? 167 : 300;
    const max = (pct / 100) * ip;
    const rating = pct === 125 ? (STD().find((s) => Math.abs(s - max) < 1e-9) ?? nextStd(max)) : maxStdAtMost(max);
    d = { designA: ip, loadA: ip, rule: "450-3(b): protección del primario solamente", protectsConductor: true, nextHigherAllowed: true, ratingA: rating, maxA: pct === 125 ? nextStd(max) : max, maxRule: `450-3(b) ${pct} %` };
    steps.push({
      label: "Protección máxima del primario",
      formula: `I_prot ≤ ${pct} % · I_pri${pct === 125 ? " (si no es estándar, el inmediato superior: Tabla 450-3(b) nota 1)" : ""}`,
      substitution: `${pct / 100} · ${fmtNum(ip, 2)} = ${fmtNum(max, 2)} A`,
      result: rating ? `${rating} A` : "sin valor estándar",
      refs: ["NOM-001-SEDE-2012 Tabla 450-3(b)", "240-6(a)"],
    });
  } else if (c.items.length === 1 && motors.length === 1 && motors[0]!.kind === "motor") {
    // ---- Circuito derivado de un motor: 430-22 y 430-52.
    const m = motors[0]!;
    const mo = m.motor!;
    let factor = 1.25;
    let ruleTxt = "430-22: 125 % de la corriente de plena carga";
    let basis = mo.flcA;
    if (mo.dutyClass !== "continuo") {
      const t = data().table("tabla-430-22-e", "duty-cycle");
      const row = t.data.rows.find((r) => r.dutyClass === mo.dutyClass);
      const j = t.data.ratings.findIndex((r) => r.id === mo.dutyRating);
      const pct = row?.percents[j] ?? null;
      if (pct === null || pct === undefined) issues.push({ severity: "error", message: `${m.tag}: la Tabla 430-22(e) no da porcentaje para ese régimen y especificación de tiempo.` });
      else {
        factor = pct / 100;
        ruleTxt = `430-22(e): ${pct} % de la corriente de placa (servicio no continuo)`;
        if (mo.nameplateA) basis = mo.nameplateA;
        else issues.push({ severity: "warning", message: `${m.tag}: 430-22(e) usa la corriente de placa; no se capturó y se usa la de tabla.` });
      }
    }
    const designA = factor * basis;
    steps.push({ label: "Corriente de diseño del conductor", formula: `I_d = ${factor} · I`, substitution: `I_d = ${factor} · ${fmtNum(basis, 2)} (${mo.flcSource})`, result: A(designA), refs: [`NOM-001-SEDE-2012 ${ruleTxt.split(":")[0]}`] });
    const t52 = data().table("tabla-430-52", "motor-protection");
    const rowId = c.m === 1 ? "monofasico" : ({ jaula: "jaula", "jaula-b-eficiente": "jaula-b-eficiente", "rotor-devanado": "rotor-devanado", sincrono: "sincrono", cc: "cc" } as Record<string, string>)[mo.motorType] ?? "jaula";
    const devId = deviceType === "electronico" ? "itm" : deviceType;
    const row = t52.data.rows.find((r) => r.motorType === rowId)!;
    const col = t52.data.devices.findIndex((x) => x.id === devId);
    const pct = row.percents[col]!;
    const max = (pct / 100) * mo.flcA;
    const exact = STD().find((s) => Math.abs(s - max) < 1e-9);
    const rating = exact ?? nextStd(max);
    d = { designA, loadA: mo.flcA, rule: "430-52: protección del circuito derivado de motor", protectsConductor: false, nextHigherAllowed: false, ratingA: rating, maxA: rating, maxRule: `430-52 ${pct} % (Exc. 1)` };
    steps.push({
      label: "Protección contra cortocircuito y falla a tierra",
      formula: `I_prot ≤ ${pct} % · I_pc ; si no es estándar, el inmediato superior (430-52(c)(1) Exc. 1)`,
      substitution: `${pct / 100} · ${fmtNum(mo.flcA, 2)} = ${fmtNum(max, 2)} A (${t52.data.devices[col]!.label}, ${row.label})`,
      result: rating ? `${rating} A` : "sin valor estándar",
      refs: ["NOM-001-SEDE-2012 Tabla 430-52", "240-6(a)"],
    });
    if (deviceType === "electronico") steps.push({ label: "Nota", result: "Interruptor de disparo ajustable evaluado con la columna de tiempo inverso." });
  } else if (c.items.length === 1 && motors.length === 1 && motors[0]!.kind === "variador") {
    // ---- Circuito de un variador: 430-122(a).
    const v = motors[0]!.vfd!;
    const designA = 1.25 * v.inputA;
    const rating = nextStd(designA);
    d = { designA, loadA: v.inputA, rule: "430-122(a): 125 % de la corriente de entrada del variador", protectsConductor: true, nextHigherAllowed: true, ratingA: rating };
    steps.push({ label: "Corriente de diseño del conductor", formula: "I_d = 1.25 · I_ent", substitution: `I_d = 1.25 · ${fmtNum(v.inputA, 2)} (${v.inputSource})`, result: A(designA), refs: ["NOM-001-SEDE-2012 430-122(a)"] });
    steps.push({ label: "Protección propuesta", result: rating ? `${rating} A` : "—", refs: ["Valor estándar ≥ corriente de diseño (240-6(a)). Confirmar con las instrucciones del fabricante del variador (430-130)."] });
    issues.push({ severity: "info", message: `${motors[0]!.tag}: confirme la protección con el fabricante del variador (430-130).` });
  } else if (motors.length > 0) {
    // ---- Alimentador con motores: 430-24 (conductor) y 430-62/430-63 (protección).
    const flcs = motors.map((m) => ({ tag: m.tag, a: m.kind === "motor" ? m.motor!.flcA : m.vfd!.inputA }));
    const largest = flcs.reduce((a, b) => (b.a > a.a ? b : a));
    const others = flcs.filter((x) => x !== largest).reduce((s, x) => s + x.a, 0);
    const cont = loads.filter((l) => l.continuous).reduce((s, l) => s + l.amps, 0) + 0;
    const noncont = loads.filter((l) => !l.continuous).reduce((s, l) => s + l.amps, 0) + trafos.reduce((s, t) => s + t.amps, 0);
    const contF = c.assembly100 ? 1 : 1.25;
    const designA = 1.25 * largest.a + others + noncont + contF * cont;
    const loadA = largest.a + others + noncont + cont;
    steps.push({
      label: "Corriente de diseño del alimentador (430-24)",
      formula: "I_d = 1.25 · I_mayor + Σ I_otros motores + I_no continua + 1.25 · I_continua",
      substitution: `I_d = 1.25 · ${fmtNum(largest.a, 2)} (${largest.tag}) + ${fmtNum(others, 2)} + ${fmtNum(noncont, 2)} + ${contF} · ${fmtNum(cont, 2)}`,
      result: A(designA),
      refs: ["NOM-001-SEDE-2012 430-24", ...(cont > 0 ? ["215-2(a)(1)"] : [])],
    });
    // 430-62(a): la mayor protección de derivado + las demás corrientes.
    const branchMax = c.downstreamMotorProtection.length ? c.downstreamMotorProtection.reduce((a, b) => (b.ratingA > a.ratingA ? b : a)) : undefined;
    const largestProt = branchMax?.ratingA ?? nextStd(2.5 * largest.a)!;
    const otherAfterLargest = flcs.reduce((s, x) => s + x.a, 0) - (branchMax ? branchMax.flcA : largest.a);
    const max = largestProt + otherAfterLargest + noncont + contF * cont;
    const rating = maxStdAtMost(max);
    d = { designA, loadA, rule: "430-24 y 430-62(a)/430-63: alimentador de motores", protectsConductor: false, nextHigherAllowed: false, ratingA: rating, maxA: max, maxRule: "430-62(a)" };
    steps.push({
      label: "Protección máxima del alimentador (430-62(a), 430-63)",
      formula: "I_prot ≤ mayor protección de derivado + Σ demás corrientes de motores + otras cargas",
      substitution: `${largestProt} A${branchMax ? ` (${branchMax.tag})` : " (estimada al 250 %)"} + ${fmtNum(otherAfterLargest, 2)} + ${fmtNum(noncont + contF * cont, 2)} = ${fmtNum(max, 2)} A`,
      result: rating ? `${rating} A (valor estándar no mayor)` : "—",
      refs: ["NOM-001-SEDE-2012 430-62(a)", "430-63", "240-6(a)"],
    });
  } else {
    // ---- Circuito general: 210-19/210-20 (derivado) o 215-2/215-3 (alimentador).
    const cont = loads.filter((l) => l.continuous).reduce((s, l) => s + l.amps, 0);
    const noncont = loads.filter((l) => !l.continuous).reduce((s, l) => s + l.amps, 0) + trafos.reduce((s, t) => s + t.amps, 0);
    const contF = c.assembly100 ? 1 : 1.25;
    const designA = noncont + contF * cont;
    const branch = c.circuitKind === "derivado";
    const rating = nextStd(designA);
    const outlets = loads.reduce((s, l) => s + (l.receptacleOutlets ?? 0), 0);
    general = true;
    d = {
      designA,
      loadA: noncont + cont,
      rule: branch ? "210-19(a)(1) y 210-20(a)" : "215-2(a)(1) y 215-3",
      protectsConductor: true,
      nextHigherAllowed: !(branch && outlets > 1),
      ratingA: rating,
    };
    for (const l of loads) steps.push({ label: `${l.tag}: corriente`, result: `${A(l.amps)} — ${l.continuous ? "continua" : "no continua"} (${l.continuousSource})` });
    steps.push({
      label: "Corriente de diseño",
      formula: c.assembly100 ? "I_d = I_no continua + I_continua (ensamble al 100 %)" : "I_d = I_no continua + 1.25 · I_continua",
      substitution: `I_d = ${fmtNum(noncont, 2)} + ${contF} · ${fmtNum(cont, 2)}`,
      result: A(designA),
      refs: [`NOM-001-SEDE-2012 ${branch ? "210-19(a)(1)" : "215-2(a)(1)"}`],
    });
    steps.push({ label: "Protección", formula: "I_prot ≥ I_d (valor estándar inmediato)", result: rating ? `${rating} A` : "—", refs: [`NOM-001-SEDE-2012 ${branch ? "210-20(a)" : "215-3"}`, "240-6(a)"] });
    if (branch && outlets > 1) steps.push({ label: "Nota", result: "Circuito con más de un contacto: no se permite el valor estándar inmediato superior a la ampacidad (240-4(b)(1))." });
  }

  // ---- Protección fijada por el usuario o ausencia de protección.
  let ratingA = d.ratingA;
  if (!c.breaker) {
    ratingA = undefined;
    issues.push({
      severity: c.transformerSecondary ? "warning" : "info",
      message: c.transformerSecondary
        ? `${c.tag}: conductores del secundario sin protección en su origen; verifique las condiciones de 240-21(c) (longitud y protección en su extremo de carga).`
        : `${c.tag}: no tiene interruptor o fusible en su origen; no se verifica la protección del conductor (240-4).`,
    });
  } else if (Number.isFinite(forced)) {
    ratingA = forced;
    steps.push({ label: `${c.breaker.tag}: capacidad fijada por el usuario`, result: `${forced} A` });
    if (!STD().includes(forced)) issues.push({ severity: "warning", message: `${c.breaker.tag}: ${forced} A no es un valor estándar de 240-6(a).` });
    if (d.maxA !== undefined && forced > d.maxA + 1e-9) issues.push({ severity: "error", message: `${c.breaker.tag}: ${forced} A excede el máximo permitido (${fmtNum(d.maxA, 2)} A, ${d.maxRule}).` });
    if (general && forced < d.designA - 1e-9) issues.push({ severity: "error", message: `${c.breaker.tag}: ${forced} A es menor que la corriente de diseño (${A(d.designA)}).` });
  } else if (ratingA === undefined) {
    issues.push({ severity: "error", message: `${c.tag}: no hay un valor estándar de protección para ${A(d.designA)}.` });
  }
  return { designA: d.designA, loadA: d.loadA, rule: d.rule, ratingA, protectsConductor: d.protectsConductor, nextHigherAllowed: d.nextHigherAllowed && (ratingA ?? 0) <= 800, steps, issues };
}

// ---------------------------------------------------------------- Conductor

interface Candidate {
  designation: string;
  /** Valor de la tabla a la temperatura del conductor (sin factores). */
  base: number;
  system: string;
  areaMm2: number;
  ampTerm: number;
  ampCond: number;
  ampFinal: number;
}

const SMALL_CU_MAX: Record<string, number> = { "14": 15, "12": 20, "10": 30 };

function conductor(c: SizingCircuit, p: ProtectionDecision, drop: DropEvaluator): ConductorDecision {
  const steps: TraceStep[] = [];
  const issues: ConductorDecision["issues"] = [];
  const material = c.params.material === "Al" ? "Al" : "Cu";
  const npar = Math.max(1, n(c.params.conductorsPerPhase, 1));
  const method = racewayMethod(c.params.installationMethod);
  const fail = (msg: string): ConductorDecision => {
    issues.push({ severity: "error", message: `${c.tag}: ${msg}` });
    return { designation: "—", system: "", areaMm2: 0, conductorsPerPhase: npar, material, ampacityA: 0, governing: "ampacidad", dropPct: NaN, steps, issues };
  };
  if (!method) return fail("método de instalación no reconocido.");
  if (c.vNomLL > 2000) return fail("circuitos de más de 2000 V (media tensión) fuera del alcance de la fase 1.");

  // ---- Temperatura del conductor (Tabla 310-104(a)).
  const ins = data().table("tabla-310-104-a", "insulation-types").data.rows.find((r) => r.type === c.params.insulationType);
  if (!ins) return fail(`tipo de aislamiento "${String(c.params.insulationType)}" no está en la Tabla 310-104(a).`);
  const tCondRaw = Math.max(...ins.ratings.map((r) => r.temperatureC));
  const tCond = tCondRaw >= 90 ? 90 : tCondRaw >= 75 ? 75 : 60;
  steps.push({ label: "Temperatura nominal del conductor", substitution: `${ins.type}: ${ins.ratings.map((r) => `${r.temperatureC} °C ${r.locations.toLowerCase()}`).join("; ")}`, result: `${tCond} °C`, refs: ["NOM-001-SEDE-2012 Tabla 310-104(a)", "Se toma la mayor temperatura del aislamiento; en lugares mojados aplica la indicada para ellos."] });

  // ---- Temperatura de terminales (110-14(c)).
  const single = c.items.length === 1 ? c.items[0]! : undefined;
  const motorLetter = single?.kind === "motor" && ["B", "C", "D", "E"].includes(single.motor!.designLetter);
  const circuitRating = p.ratingA ?? p.designA;
  let tTerm: number;
  let tTermWhy: string;
  const tp = String(c.params.terminalTempC ?? "auto");
  if (tp !== "auto") {
    tTerm = Number(tp);
    tTermWhy = "valor capturado por el usuario";
  } else if (motorLetter) {
    tTerm = 75;
    tTermWhy = `motor con letra de diseño ${single!.motor!.designLetter}: se permiten 75 °C (110-14(c)(1)(a)(4))`;
  } else if (circuitRating <= 100) {
    tTerm = 60;
    tTermWhy = `circuito de ${fmtNum(circuitRating, 0)} A ≤ 100 A (110-14(c)(1)(a))`;
  } else {
    tTerm = 75;
    tTermWhy = `circuito de ${fmtNum(circuitRating, 0)} A > 100 A (110-14(c)(1)(b))`;
  }
  tTerm = Math.min(tTerm, tCond);
  steps.push({ label: "Temperatura de terminales", substitution: tTermWhy, result: `${tTerm} °C`, refs: ["NOM-001-SEDE-2012 110-14(c)"] });

  // ---- Factor por temperatura ambiente (Tabla 310-15(b)(2)(a)).
  const tc = data().table("tabla-310-15-b-2-a", "temperature-correction");
  const tRow = tc.data.rows.find((r) => (r.ambientFromC === null ? c.ambientC <= r.ambientToC : c.ambientC >= r.ambientFromC && c.ambientC <= r.ambientToC + 0.999));
  const ft = tRow?.factors[tc.data.temperaturesC.indexOf(tCond)] ?? null;
  if (ft === null) return fail(`un conductor de ${tCond} °C no puede operar a ${c.ambientC} °C de ambiente (Tabla 310-15(b)(2)(a)).`);
  steps.push({ label: "Factor de corrección por temperatura ambiente", substitution: `${c.ambientC} °C (${c.ambientSource}), columna de ${tCond} °C`, result: `${ft}`, refs: ["NOM-001-SEDE-2012 Tabla 310-15(b)(2)(a)"] });

  // ---- Conductores portadores de corriente y factor de agrupamiento.
  const nonLinear = c.items.some((i) => i.nonLinear);
  const perSet = c.m === 1 ? 2 : c.system === "3F4H" && nonLinear ? 4 : 3;
  const grouped = n(c.params.groupedConductors);
  const count = Number.isFinite(grouped) ? grouped : perSet;
  const tray = method.value.startsWith("charola-");
  const trayType = String(c.params.trayCableType ?? "multiconductor");
  const adj = data().table("tabla-310-15-b-3-a", "adjustment-factors");
  const factorFor = (k: number) => (k <= 3 ? 1 : (adj.data.rows.find((r) => k >= r.conductorsFrom && (r.conductorsTo === null || k <= r.conductorsTo))?.percent ?? 35) / 100);
  let fa = 1;
  let faWhy: string;
  if (method.value === "aire-libre") faWhy = "conductores al aire libre: sin factor de agrupamiento";
  else if (tray && trayType === "unipolar") faWhy = "charola con cables de un solo conductor: no se aplica 310-15(b)(3)(a) (392-80(a)(2))";
  else if (method.value === "ducto-metalico") {
    fa = count > 30 ? factorFor(count) : 1;
    faWhy = `${count} conductores portadores de corriente en ducto metálico (376-22(b): factores solo con más de 30)`;
  } else {
    fa = factorFor(count);
    faWhy = `${count} conductores portadores de corriente ${tray ? "en el cable multiconductor (392-80(a)(1)(a))" : "en la canalización"}${perSet === 4 ? " (neutro con carga no lineal, 310-15(b)(5)(3))" : ""}`;
  }
  steps.push({ label: "Factor de ajuste por agrupamiento", substitution: faWhy, result: `${fa}`, refs: ["NOM-001-SEDE-2012 Tabla 310-15(b)(3)(a)"] });

  // ---- Tabla de ampacidad y factor de charola (392-80).
  const covered = c.params.trayCovered === true;
  let tableId = method.ampacityTable ?? "tabla-310-15-b-16";
  let trayFactor = (_d: string) => 1;
  if (tray) {
    if (trayType === "unipolar") {
      tableId = "tabla-310-15-b-17";
      trayFactor = (d) => (isAtLeast(d, "600") ? (covered ? 0.7 : 0.75) : covered ? 0.6 : 0.65);
      steps.push({ label: "Charola con cables de un solo conductor", result: `Tabla 310-15(b)(17) × ${covered ? "0.60 (1/0–500) / 0.70 (≥ 600 kcmil)" : "0.65 (1/0–500) / 0.75 (≥ 600 kcmil)"}`, refs: ["NOM-001-SEDE-2012 392-80(a)(2)(a)(b)", "Calibres menores a 1/0 no se permiten como conductores individuales en charola (392-10(b)(1))."] });
    } else {
      tableId = "tabla-310-15-b-16";
      trayFactor = () => (covered ? 0.95 : 1);
      steps.push({ label: "Charola con cable multiconductor", result: `Tabla 310-15(b)(16)${covered ? " × 0.95 (tapa sólida, 392-80(a)(1)(b))" : ""}`, refs: ["NOM-001-SEDE-2012 392-80(a)(1)"] });
    }
  }
  const amp = data().table(tableId, "ampacity");
  const t9 = data().table("cap10-tabla-9", "ac-impedance");
  const t8 = data().table("cap10-tabla-8", "conductor-properties");
  const colCond = amp.data.temperaturesC.indexOf(tCond);
  const colTerm = amp.data.temperaturesC.indexOf(tTerm);
  const mat = material === "Cu" ? "cu" : "al";
  const area = (d: string) => t8.data.rows.find((r) => r.designation === d)?.areaMm2 ?? amp.data.rows.find((r) => r.designation === d)!.areaMm2!;

  const candidates: Candidate[] = [];
  for (const r of amp.data.rows) {
    if (["18", "16"].includes(r.designation)) continue;
    if (npar > 1 && !isAtLeast(r.designation, "1/0")) continue;
    if (tray && trayType === "unipolar" && !isAtLeast(r.designation, "1/0")) continue;
    if (!t9.data.rows.some((x) => x.designation === r.designation)) continue;
    const aCond = r[mat][colCond];
    const aTerm = r[mat][colTerm];
    if (aCond === null || aCond === undefined || aTerm === null || aTerm === undefined) continue;
    const ampCond = aCond * ft * fa * trayFactor(r.designation) * npar;
    const ampTerm = aTerm * npar;
    candidates.push({ designation: r.designation, base: aCond, system: r.system, areaMm2: area(r.designation), ampTerm, ampCond, ampFinal: Math.min(ampCond, ampTerm) });
  }
  if (!candidates.length) return fail("no hay calibres disponibles para estas condiciones.");

  const motorCircuit = !p.protectsConductor;
  const check = (cand: Candidate): { ok: boolean; reasons: string[]; byProtection: boolean } => {
    const reasons: string[] = [];
    let byProtection = false;
    if (cand.ampTerm < p.designA - 1e-9) reasons.push(`ampacidad a ${tTerm} °C ${A(cand.ampTerm)} < corriente de diseño ${A(p.designA)} (110-14(c))`);
    const need = motorCircuit ? p.designA : p.loadA;
    if (cand.ampFinal < need - 1e-9) reasons.push(`ampacidad corregida ${A(cand.ampFinal)} < ${motorCircuit ? "corriente de diseño" : "carga"} ${A(need)} (310-15(b))`);
    if (p.protectsConductor && p.ratingA !== undefined) {
      const okProt = p.ratingA > 800 || !p.nextHigherAllowed ? cand.ampFinal >= p.ratingA - 1e-9 : (nextStd(cand.ampFinal) ?? Infinity) >= p.ratingA - 1e-9;
      if (!okProt) {
        reasons.push(`no queda protegido por ${p.ratingA} A con ampacidad ${A(cand.ampFinal)} (240-4${p.nextHigherAllowed ? "(b)" : p.ratingA > 800 ? "(c)" : "(b)(1)"})`);
        byProtection = true;
      }
      const small = material === "Cu" ? SMALL_CU_MAX[cand.designation] : undefined;
      if (small !== undefined && p.ratingA > small) {
        reasons.push(`${cand.designation} AWG Cu admite protección de hasta ${small} A (240-4(d))`);
        byProtection = true;
      }
    }
    return { ok: reasons.length === 0, reasons, byProtection };
  };

  const ampLine = (cand: Candidate) =>
    `${cand.designation} ${cand.system}${npar > 1 ? ` × ${npar}` : ""}: ${tCond} °C → ${fmtNum(cand.base, 0)} A · ${ft} · ${fa}${tray ? ` · ${trayFactor(cand.designation)}` : ""}${npar > 1 ? ` · ${npar}` : ""} = ${A(cand.ampCond)} ; terminales ${tTerm} °C: ${A(cand.ampTerm)} ; ampacidad = ${A(cand.ampFinal)}`;

  const forced = typeof c.params.forcedSize === "string" ? c.params.forcedSize : null;
  let chosen: Candidate;
  let governing: ConductorDecision["governing"];
  let minAmpCand: Candidate | undefined;
  if (forced) {
    const cand = candidates.find((x) => x.designation === forced);
    if (!cand) return fail(`el calibre fijado ${forced} no está disponible en estas condiciones.`);
    const r = check(cand);
    steps.push({ label: "Verificación del calibre fijado", substitution: ampLine(cand), result: r.ok ? "Cumple ampacidad y protección" : `No cumple: ${r.reasons.join("; ")}` });
    if (!r.ok) for (const reason of r.reasons) issues.push({ severity: "error", message: `${c.tag}: calibre ${forced} — ${reason}.` });
    chosen = cand;
    governing = "fijado";
    minAmpCand = candidates.find((x) => check(x).ok);
  } else {
    // Mínimo por ampacidad y protección.
    let firstAmpOnly: Candidate | undefined;
    for (const cand of candidates) {
      const r = check(cand);
      if (!firstAmpOnly && r.reasons.every((x) => x.includes("240-4"))) firstAmpOnly = cand;
      if (r.ok) {
        minAmpCand = cand;
        break;
      }
    }
    if (!minAmpCand) return fail(`ningún calibre (hasta ${candidates.at(-1)!.designation}${npar > 1 ? ` × ${npar}` : ""}) cumple; considere conductores en paralelo.`);
    governing = firstAmpOnly && firstAmpOnly !== minAmpCand ? "proteccion" : "ampacidad";
    steps.push({ label: "Calibre mínimo por ampacidad y protección", substitution: ampLine(minAmpCand), result: `${minAmpCand.designation} ${minAmpCand.system}`, refs: ["NOM-001-SEDE-2012 Tabla " + amp.reference.table.replace("Tabla ", ""), "310-15(b)", "240-4"] });
    chosen = minAmpCand;
  }

  // ---- Caída de tensión: se aumenta el calibre hasta cumplir.
  let dr = drop(chosen.designation, npar);
  if ("error" in dr) return fail(dr.error);
  if (!forced) {
    let idx = candidates.indexOf(chosen);
    while (dr.pct > dr.limitPct + 1e-9 && idx < candidates.length - 1) {
      idx++;
      const next = drop(candidates[idx]!.designation, npar);
      if ("error" in next) return fail(next.error);
      dr = next;
      chosen = candidates[idx]!;
      governing = "caida-de-tension";
    }
  }
  steps.push({
    label: "Caída de tensión con el calibre elegido",
    result: `${fmtNum(dr.pct, 3)} % ${dr.pct <= dr.limitPct + 1e-9 ? "≤" : ">"} ${dr.limitPct} % (${dr.limitSource})`,
  });
  if (dr.pct > dr.limitPct + 1e-9) issues.push({ severity: "error", message: `${c.tag}: caída de tensión ${fmtNum(dr.pct, 2)} % > ${dr.limitPct} % (${dr.limitSource})${forced ? " con el calibre fijado" : "; ni el mayor calibre disponible cumple, considere conductores en paralelo"}.` });
  if (governing === "caida-de-tension") steps.push({ label: "Calibre aumentado por caída de tensión", result: `${chosen.designation} ${chosen.system}` });

  // ---- Conductor de puesta a tierra de equipos (250-122).
  let egc: ConductorDecision["egc"];
  if (c.params.includeEgc !== false) {
    if (p.ratingA === undefined) {
      issues.push({
        severity: "info",
        message: c.transformerSecondary
          ? `${c.tag}: conductores del secundario de un sistema derivado separado; su puente de unión se dimensiona con 250-30(a) y la Tabla 250-66 (fase posterior), no con la Tabla 250-122.`
          : `${c.tag}: sin protección en el origen; el conductor de puesta a tierra no se dimensiona con la Tabla 250-122.`,
      });
    } else {
      const t122 = data().table("tabla-250-122", "egc-size");
      const row = t122.data.rows.find((r) => r.maxRatingA >= p.ratingA! - 1e-9);
      if (!row) issues.push({ severity: "error", message: `${c.tag}: la Tabla 250-122 no cubre protecciones de ${p.ratingA} A.` });
      else {
        let g = material === "Al" && row.al ? row.al : row.cu;
        const gSteps = [`${p.ratingA} A → ${g.designation} ${g.system} ${material === "Al" && row.al ? "Al" : "Cu"} (${g.areaMm2} mm²)`];
        if (material === "Al" && !row.al) gSteps.push("la tabla no da aluminio para esta protección: se usa cobre");
        // 250-122(b): aumento proporcional si la fase es mayor que el mínimo con ampacidad suficiente
        // (sea por caída de tensión o porque el usuario fijó un calibre mayor).
        if (minAmpCand && chosen.areaMm2 > minAmpCand.areaMm2 + 1e-9) {
          const ratio = chosen.areaMm2 / minAmpCand.areaMm2;
          const needArea = (g.areaMm2 ?? 0) * ratio;
          const up = t8.data.rows.find((r) => (r.areaMm2 ?? 0) >= needArea - 1e-6 && r.strands > 1) ?? t8.data.rows.at(-1)!;
          gSteps.push(`aumento proporcional (250-122(b)): ${fmtNum(g.areaMm2 ?? 0, 2)} · ${fmtNum(chosen.areaMm2, 2)} / ${fmtNum(minAmpCand.areaMm2, 2)} = ${fmtNum(needArea, 2)} mm² → ${up.designation}`);
          g = { designation: up.designation, system: up.system, areaMm2: up.areaMm2 };
        }
        // 250-122(a): no mayor que los conductores del circuito.
        if ((g.areaMm2 ?? 0) > chosen.areaMm2) {
          gSteps.push(`no se exige mayor que la fase (250-122(a)) → ${chosen.designation}`);
          g = { designation: chosen.designation, system: chosen.system as typeof g.system, areaMm2: chosen.areaMm2 };
        }
        egc = { designation: g.designation, system: g.system, areaMm2: g.areaMm2 ?? 0, perRaceway: npar > 1 };
        steps.push({ label: "Conductor de puesta a tierra de equipos", substitution: gSteps.join(" ; "), result: `${g.designation} ${g.system}${npar > 1 ? " en cada canalización (250-122(f))" : ""}`, refs: ["NOM-001-SEDE-2012 Tabla 250-122", ...(motorCircuit && c.items.length === 1 ? ["250-122(d)(1)"] : [])] });
      }
    }
  }

  return { designation: chosen.designation, system: chosen.system, areaMm2: chosen.areaMm2, conductorsPerPhase: npar, material, ampacityA: chosen.ampFinal, governing, dropPct: dr.pct, egc, steps, issues };
}

/** Compara calibres por área: ¿d es mayor o igual que ref? */
function isAtLeast(d: string, ref: string): boolean {
  const rows = data().table("tabla-310-15-b-16", "ampacity").data.rows;
  const i = rows.findIndex((r) => r.designation === d);
  const j = rows.findIndex((r) => r.designation === ref);
  return i >= j;
}

export const nomSizing: NormSizing = { protection, conductor };
