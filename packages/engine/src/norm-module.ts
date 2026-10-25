import type { EnumOption, ParamValue } from "@rea/core";

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
}

/** Módulo nulo: para normas sin datos. No ofrece opciones ni valores por defecto. */
export function unavailableNormModule(id: string, edition: string, label: string, reason: string): NormModule {
  return { id, edition, label, available: false, unavailableReason: reason, options: () => undefined, paramDefaults: () => ({}) };
}
