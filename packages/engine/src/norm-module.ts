import type { EnumOption, ParamValue } from "@rea/core";
import type { TraceStep } from "./trace";

/** Un límite numérico con la cita de su origen, para que la memoria de cálculo lo muestre. */
export interface Criterion {
  /** Valor en %. */
  pct: number;
  source: string;
  /** true = requisito obligatorio de la norma; false = recomendación (nota informativa) o criterio de diseño. */
  mandatory: boolean;
}

/** Límites de caída de tensión de una norma. */
export interface VoltageDropCriteria {
  branch: Criterion;
  feeder: Criterion;
  total: Criterion;
  /** Casos especiales con límites propios (equipo electrónico sensible, bombas contra incendio...). */
  special: {
    id: "electronico-sensible" | "bomba-contra-incendio";
    label: string;
    branch?: Criterion;
    total?: Criterion;
    /** Caída máxima en terminales del motor en operación (al % de corriente indicado). */
    motorRunning?: Criterion & { atCurrentPctOfFlc: number };
    /** Caída máxima en terminales de línea del controlador durante el arranque. */
    motorStarting?: Criterion;
  }[];
}

/**
 * Tolerancia de tensión de los equipos respecto a su tensión de placa.
 * - Hasta `continuousPct`: operación continua a potencia nominal.
 * - Hasta `limitPct`: operación admisible con restricciones (advertencia).
 * - Más allá: fuera de la tolerancia del fabricante (error).
 */
export interface EquipmentVoltageTolerance {
  continuousPct: number;
  limitPct: number;
  source: string;
}

export interface EquipmentVoltageCriteria {
  motor: EquipmentVoltageTolerance;
  other: EquipmentVoltageTolerance;
}

/**
 * Tolerancias de motores según normas de producto (no dependen de la norma de instalación):
 * NEMA MG-1 y IEC 60034-1, tal como las aplican los fabricantes.
 */
export const DEFAULT_EQUIPMENT_VOLTAGE: EquipmentVoltageCriteria = {
  motor: {
    continuousPct: 5,
    limitPct: 10,
    source:
      "IEC 60034-1 zona A ±5 % (operación continua a potencia nominal; Siemens, catálogo de motores ME 81) y zona B / NEMA MG-1 ±10 % de la tensión de placa (operación admisible con reducción de desempeño; citado en IEEE Std 141 y guías de fabricantes)",
  },
  other: {
    continuousPct: 5,
    limitPct: 10,
    source:
      "Criterio de diseño de la herramienta (configurable), análogo a la tolerancia de motores; no se localizó una tolerancia de fabricante única para cargas que no son motores",
  },
};

/** Resultado de una consulta a tablas de la norma, con su traza. */
export type Lookup<T> = ({ ok: true } & T & { refs: string[]; notes: string[] }) | { ok: false; error: string };

export interface MotorFlcQuery {
  ratedPower: number;
  ratedPowerUnit: "hp" | "kW";
  voltageV: number;
  /** "3F" trifásico, "1F" monofásico, "cc" corriente continua. */
  phases: "3F" | "1F" | "cc";
  synchronous: boolean;
}

export interface ConductorImpedanceQuery {
  designation: string;
  material: "Cu" | "Al";
  installationMethod: string;
}

/** Cálculos y consultas que dependen de la norma (tablas de motores, impedancias...). */
export interface NormCalc {
  /** Corriente a plena carga de motores según las tablas de la norma. */
  motorFlc(q: MotorFlcQuery): Lookup<{ amps: number; tableVoltageV: number; hp: string }>;
  /** R y XL de un conductor (Ω/km, por conductor, a la temperatura de la tabla). */
  conductorImpedance(q: ConductorImpedanceQuery): Lookup<{ rOhmPerKm: number; xOhmPerKm: number; column: string; temperatureC: number }>;
}

// ---------------------------------------------------------------- Dimensionamiento

/** Una carga (o equipo) alimentada por el circuito, con su corriente a la tensión del circuito. */
export interface SizingLoadItem {
  elementId: string;
  tag: string;
  kind: "motor" | "variador" | "transformador" | "carga";
  /** Corriente a la tensión nominal del circuito (A). Motores: tabla o placa. */
  amps: number;
  /** Solo "carga": si es continua (3 h o más) y de dónde sale la clasificación. */
  continuous?: boolean;
  continuousSource?: string;
  /** Contactos: número de salidas (240-4(b)(1)). */
  receptacleOutlets?: number;
  nonLinear?: boolean;
  motor?: { flcA: number; flcSource: string; motorType: string; dutyClass: string; dutyRating: string; designLetter: string; nameplateA: number | null };
  transformer?: { ratedPrimaryA: number; sn: number; primaryV: number };
  vfd?: { inputA: number; inputSource: string };
}

/** Descripción de un circuito (cable + su protección de origen) para dimensionar. */
export interface SizingCircuit {
  cableId: string;
  tag: string;
  params: Record<string, ParamValue>;
  circuitKind: "alimentador" | "derivado";
  /** 3 = trifásico; 1 = monofásico de dos conductores. */
  m: 3 | 1;
  system: string | null;
  vNomLL: number;
  /** Tensión del circuito (fase-neutro en trifásico; la del circuito en monofásico). */
  vc: number;
  items: SizingLoadItem[];
  /** Interruptor o fusible en el origen del cable (si existe). */
  breaker?: { elementId: string; tag: string; params: Record<string, ParamValue> };
  /** El tablero de origen está aprobado para operar al 100 %. */
  assembly100: boolean;
  ambientC: number;
  ambientSource: string;
  /** Conductores del secundario de un transformador (240-21(c)). */
  transformerSecondary: boolean;
  /** Protecciones de los circuitos derivados de motor aguas abajo (para 430-62). */
  downstreamMotorProtection: { elementId: string; tag: string; ratingA: number; flcA: number }[];
}

export interface ProtectionDecision {
  /** Corriente de diseño del conductor (A), ya con 125 % u otros factores. */
  designA: number;
  /** Corriente de la carga al 100 % (A). */
  loadA: number;
  rule: string;
  /** Capacidad nominal del dispositivo de protección (A), si hay protección. */
  ratingA?: number;
  /** El conductor debe estar protegido por este dispositivo según 240-4 (false en circuitos de motor). */
  protectsConductor: boolean;
  /** Permite tomar el valor estándar inmediato superior a la ampacidad (240-4(b)). */
  nextHigherAllowed: boolean;
  steps: TraceStep[];
  issues: { severity: "error" | "warning" | "info"; message: string }[];
}

export interface ConductorDecision {
  designation: string;
  system: string;
  areaMm2: number;
  conductorsPerPhase: number;
  material: "Cu" | "Al";
  /** Ampacidad final por fase (A) = min(corregida y ajustada, terminales). */
  ampacityA: number;
  /** Criterio que definió el calibre. */
  governing: "ampacidad" | "proteccion" | "caida-de-tension" | "fijado";
  dropPct: number;
  egc?: { designation: string; system: string; areaMm2: number; perRaceway: boolean };
  steps: TraceStep[];
  issues: { severity: "error" | "warning" | "info"; message: string }[];
}

/** Evalúa la caída de tensión del circuito con un calibre dado, y el límite que le aplica. */
export type DropEvaluator = (designation: string, conductorsPerPhase: number) => { pct: number; limitPct: number; limitSource: string } | { error: string };

export interface NormSizing {
  /** Corriente de diseño y protección del circuito (se llama de aguas abajo hacia la fuente). */
  protection(c: SizingCircuit): ProtectionDecision;
  /** Calibre mínimo que cumple todos los criterios, o verificación del calibre fijado. */
  conductor(c: SizingCircuit, p: ProtectionDecision, drop: DropEvaluator): ConductorDecision;
}

/**
 * Contrato de un módulo normativo. El motor y la interfaz solo conocen esta interfaz;
 * cada norma (NOM-001-SEDE, NEC, IEC 60364) la implementa en el paquete @rea/norms.
 * En etapas siguientes se agregan aquí los criterios de cálculo (ampacidad, protección, tierra...).
 */
export interface NormModule {
  id: string;
  edition: string;
  /** Nombre para mostrar, p. ej. "NOM-001-SEDE-2012". */
  label: string;
  /** false si aún no hay tablas capturadas para esta norma/edición. */
  available: boolean;
  unavailableReason?: string;
  /**
   * Opciones de los parámetros con proveedor `norm:*` (aislamientos, métodos de instalación,
   * calibres, medidas de canalización). `params` son los del elemento: algunas opciones dependen
   * de otros datos. Devuelve [] si el parámetro no aplica con esos datos.
   */
  options(provider: string, params?: Record<string, ParamValue>): EnumOption[] | undefined;
  /** Valores por defecto que la norma propone al crear un elemento de ese tipo. */
  paramDefaults(type: string): Record<string, ParamValue>;
  /** Límites de caída de tensión de la norma (undefined si no hay datos). */
  voltageDrop?: VoltageDropCriteria;
  /** Consultas de cálculo (undefined si la norma no tiene datos). */
  calc?: NormCalc;
  /** Reglas de dimensionamiento de conductores, protecciones y tierra. */
  sizing?: NormSizing;
}

/** Módulo nulo: para normas sin datos. No ofrece opciones ni valores por defecto. */
export function unavailableNormModule(id: string, edition: string, label: string, reason: string): NormModule {
  return { id, edition, label, available: false, unavailableReason: reason, options: () => undefined, paramDefaults: () => ({}) };
}
