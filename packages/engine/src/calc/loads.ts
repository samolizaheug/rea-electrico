import type { ElementTypeDefinition, ProjectElement } from "@rea/core";
import type { NormModule } from "../norm-module";
import { fmtNum, type Trace, type TraceStep } from "../trace";
import { Complex } from "./complex";

export interface LoadDemand {
  /** Potencia compleja demandada (VA, total del circuito), ya con factor de demanda. */
  s: Complex;
  /** Corriente que la norma asigna al equipo (motores: tabla o placa), si aplica. */
  ratedCurrentA?: number;
  trace: Trace;
  error?: string;
}

const n = (v: unknown, fallback = NaN) => (typeof v === "number" ? v : fallback);
const sinOf = (pf: number) => Math.sqrt(Math.max(0, 1 - pf * pf));

/**
 * Potencia de una carga según su comportamiento de cálculo.
 * `vSystemLL`: tensión nominal entre fases de la zona; `vCircuit`: tensión del circuito de una carga monofásica.
 */
export function loadDemand(el: ProjectElement, def: ElementTypeDefinition, norm: NormModule, vSystemLL: number, vCircuit: number): LoadDemand {
  const steps: TraceStep[] = [];
  const pf = n(el.params.powerFactor);
  const fd = n(el.params.demandFactor, 1);
  const title = `${el.tag}: potencia demandada`;
  const fail = (error: string): LoadDemand => ({ s: Complex.ZERO, trace: { title, steps }, error: `${el.tag}: ${error}` });
  if (!(pf > 0 && pf <= 1)) return fail("factor de potencia no válido.");

  let sVA: number;
  let ratedCurrentA: number | undefined;
  switch (def.calcBehavior) {
    case "load.motor": {
      const sys = String(el.params.system ?? "3F3H");
      const phases = sys.startsWith("3F") ? "3F" : "1F";
      const vRated = n(el.params.voltageV);
      if (el.params.currentSource === "placa") {
        const ip = n(el.params.nameplateCurrentA);
        if (!(ip > 0)) return fail("falta la corriente de placa.");
        ratedCurrentA = ip;
        steps.push({ label: "Corriente del motor (dato de placa)", result: `${fmtNum(ip, 1)} A` });
      } else {
        if (!norm.calc) return fail(`la norma ${norm.label} no tiene tablas de motores cargadas.`);
        const r = norm.calc.motorFlc({
          ratedPower: n(el.params.ratedPower),
          ratedPowerUnit: el.params.ratedPowerUnit === "kW" ? "kW" : "hp",
          voltageV: vRated,
          phases,
          synchronous: el.params.motorType === "sincrono",
        });
        if (!r.ok) return fail(r.error);
        ratedCurrentA = r.amps;
        steps.push({
          label: "Corriente a plena carga del motor (tabla)",
          substitution: `${r.hp} hp, ${phases === "3F" ? "trifásico" : "monofásico"}, columna de ${r.tableVoltageV} V`,
          result: `${fmtNum(r.amps, 1)} A`,
          refs: [...r.refs, ...r.notes],
        });
      }
      // La corriente de tabla se toma como la corriente del circuito a la tensión nominal del sistema.
      sVA = phases === "3F" ? Math.sqrt(3) * vSystemLL * ratedCurrentA : vCircuit * ratedCurrentA;
      steps.push(
        phases === "3F"
          ? { label: "Potencia aparente a la tensión nominal del sistema", formula: "S = √3 · V_sis · I", substitution: `S = √3 · ${fmtNum(vSystemLL, 0)} · ${fmtNum(ratedCurrentA, 1)}`, result: `${fmtNum(sVA / 1000, 3)} kVA` }
          : { label: "Potencia aparente a la tensión nominal del circuito", formula: "S = V · I", substitution: `S = ${fmtNum(vCircuit, 1)} · ${fmtNum(ratedCurrentA, 1)}`, result: `${fmtNum(sVA / 1000, 3)} kVA` },
      );
      break;
    }
    case "load.receptacle": {
      const qty = n(el.params.quantity);
      const va = n(el.params.vaPerOutlet);
      sVA = qty * va;
      steps.push({ label: "Carga de contactos", formula: "S = N · VA por salida", substitution: `S = ${qty} · ${fmtNum(va, 0)}`, result: `${fmtNum(sVA, 0)} VA`, refs: norm.refs?.receptacleLoad ?? [] });
      break;
    }
    case "load.lighting": {
      const qty = n(el.params.quantity);
      const w = n(el.params.wattsPerUnit);
      const p = qty * w;
      sVA = p / pf;
      steps.push({ label: "Potencia activa de alumbrado", formula: "P = N · W", substitution: `P = ${qty} · ${fmtNum(w, 0)}`, result: `${fmtNum(p, 0)} W` });
      steps.push({ label: "Potencia aparente", formula: "S = P / FP", substitution: `S = ${fmtNum(p, 0)} / ${pf}`, result: `${fmtNum(sVA, 1)} VA` });
      break;
    }
    case "load.generic": {
      const pw = n(el.params.power);
      if (el.params.powerUnit === "kVA") {
        sVA = pw * 1000;
        steps.push({ label: "Potencia aparente", result: `${fmtNum(pw, 3)} kVA` });
      } else {
        sVA = (pw * 1000) / pf;
        steps.push({ label: "Potencia aparente", formula: "S = P / FP", substitution: `S = ${fmtNum(pw, 3)} kW / ${pf}`, result: `${fmtNum(sVA / 1000, 3)} kVA` });
      }
      break;
    }
    default:
      return fail(`comportamiento de cálculo "${def.calcBehavior}" no implementado.`);
  }
  if (!(sVA > 0)) return fail("potencia no válida.");

  const sd = sVA * fd;
  if (fd !== 1) steps.push({ label: "Aplicación del factor de demanda", formula: "S_d = S · fd", substitution: `S_d = ${fmtNum(sVA, 1)} · ${fd}`, result: `${fmtNum(sd, 1)} VA` });
  const s = new Complex(sd * pf, sd * sinOf(pf));
  steps.push({
    label: "Potencias activa y reactiva",
    formula: "P = S · FP ;  Q = S · sen(arccos FP)",
    substitution: `P = ${fmtNum(sd, 1)} · ${pf} ;  Q = ${fmtNum(sd, 1)} · ${fmtNum(sinOf(pf), 4)}`,
    result: `P = ${fmtNum(s.re / 1000, 3)} kW ;  Q = ${fmtNum(s.im / 1000, 3)} kvar`,
  });
  return { s, ratedCurrentA, trace: { title, steps } };
}
