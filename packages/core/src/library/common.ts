import type { EnumOption, EnumParamDef, NumberParamDef, ParamDef } from "../registry/definition";

/**
 * Bloques de parámetros reutilizados por varios tipos de elemento.
 * Convención de almacenamiento: tensiones en V, potencias en la unidad indicada,
 * longitudes en m, temperaturas en °C, porcentajes en % y factores en p.u.
 */

/** Sistemas eléctricos. Clave estable → etiqueta. */
export const SYSTEM_OPTIONS: EnumOption[] = [
  { value: "1F2H", label: "Monofásico, 2 hilos" },
  { value: "1F3H", label: "Monofásico, 3 hilos" },
  { value: "3F3H", label: "Trifásico, 3 hilos" },
  { value: "3F4H", label: "Trifásico, 4 hilos" },
];

/** Fase o fases a las que se conecta una carga (balance por fase). */
export const PHASE_OPTIONS: EnumOption[] = [
  { value: "ABC", label: "A-B-C (trifásica)" },
  { value: "A", label: "A-N" },
  { value: "B", label: "B-N" },
  { value: "C", label: "C-N" },
  { value: "AB", label: "A-B" },
  { value: "BC", label: "B-C" },
  { value: "CA", label: "C-A" },
];

/**
 * Tensión de un sistema para mostrar: en sistemas con neutro, línea a línea / fase a neutro
 * (3F4H: V/√3, p. ej. «220/127 V»; 1F3H: V/2, p. ej. «240/120 V»); en los demás, solo «V».
 */
export function voltageText(v: number, system: unknown, digits = 0): string {
  const f = (x: number) => (digits === 0 ? String(Math.round(x)) : x.toFixed(digits));
  if (system === "3F4H") return `${f(v)}/${f(v / Math.sqrt(3))} V`;
  if (system === "1F3H") return `${f(v)}/${f(v / 2)} V`;
  return `${f(v)} V`;
}

export function voltageParam(key: string, label: string, def: number, group = "Eléctrico"): NumberParamDef {
  return { key, label, kind: "number", unit: "V", default: def, min: 0, minExclusive: true, required: true, group };
}

export function systemParam(def: string, options: EnumOption[] = SYSTEM_OPTIONS, key = "system"): EnumParamDef {
  return { key, label: "Sistema", kind: "enum", options, default: def, required: true, group: "Eléctrico" };
}

export function powerFactorParam(def: number, key = "powerFactor", label = "Factor de potencia"): NumberParamDef {
  return { key, label, kind: "number", unit: "pu", default: def, min: 0, minExclusive: true, max: 1, required: true, group: "Eléctrico" };
}

export function efficiencyParam(def: number | null, key = "efficiencyPct"): NumberParamDef {
  return { key, label: "Eficiencia", kind: "number", unit: "%", default: def, min: 0, minExclusive: true, max: 100, group: "Eléctrico" };
}

/** Parámetros comunes de toda carga: fase, demanda y clasificación de carga continua. */
export function loadCommonParams(defaultSystem: string, defaultPhase: string): ParamDef[] {
  return [
    systemParam(defaultSystem),
    {
      key: "phase",
      label: "Fase(s) de conexión",
      kind: "enum",
      options: PHASE_OPTIONS,
      default: defaultPhase,
      required: true,
      group: "Balance",
      description: "Para cargas monofásicas: fase o par de fases al que se conecta (balance de cargas).",
      visibleWhen: { param: "system", equals: ["1F2H", "1F3H"] },
    },
    {
      key: "demandFactor",
      label: "Factor de demanda",
      kind: "number",
      unit: "pu",
      default: 1,
      min: 0,
      max: 1,
      required: true,
      group: "Demanda",
    },
    {
      key: "continuous",
      label: "Carga continua",
      kind: "enum",
      options: [
        { value: "auto", label: "Según tipo de carga" },
        { value: "si", label: "Sí (3 h o más)" },
        { value: "no", label: "No" },
      ],
      default: "auto",
      required: true,
      group: "Demanda",
      description:
        "Carga continua: corriente máxima durante 3 horas o más. 'Según tipo' aplica el criterio por defecto del módulo normativo y la memoria lo indica.",
    },
  ];
}
