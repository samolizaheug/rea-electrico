/**
 * Definición declarativa de un tipo de elemento eléctrico.
 *
 * Un tipo de elemento se describe con datos: sus parámetros, sus puertos de conexión,
 * los símbolos que lo representan en cada simbología y el comportamiento de cálculo
 * que el motor debe aplicarle. Agregar un elemento nuevo consiste en escribir una
 * de estas definiciones y registrarla (ver docs/agregar-tipo-elemento.md).
 */

/** Valor almacenable de un parámetro. `null` significa "no capturado / automático". */
export type ParamValue = number | string | boolean | null;

/** Unidad en que se ALMACENA el parámetro. La interfaz puede mostrar otra (p. ej. ft). */
export type ParamUnit =
  | "V"
  | "A"
  | "VA"
  | "kVA"
  | "MVA"
  | "W"
  | "kW"
  | "kvar"
  | "hp"
  | "%"
  | "pu"
  | "m"
  | "°C"
  | "Hz";

/** Condición para mostrar un parámetro solo cuando otro tiene cierto valor. */
export interface VisibleWhen {
  param: string;
  equals: ParamValue | ParamValue[];
}

interface ParamBase {
  key: string;
  /** Etiqueta en español. La clave i18n es `element.<tipo>.param.<key>`. */
  label: string;
  description?: string;
  /** Agrupa parámetros en el panel de propiedades. */
  group?: string;
  required?: boolean;
  visibleWhen?: VisibleWhen;
}

export interface NumberParamDef extends ParamBase {
  kind: "number";
  unit?: ParamUnit;
  default?: number | null;
  min?: number;
  /** Si es true, el mínimo es exclusivo (valor > min). */
  minExclusive?: boolean;
  max?: number;
  integer?: boolean;
}

export interface EnumOption {
  value: string;
  label: string;
}

/**
 * Las opciones pueden ser fijas o venir de un proveedor externo (por ejemplo, la norma
 * activa define los métodos de instalación o los tipos de aislamiento disponibles).
 */
export interface EnumParamDef extends ParamBase {
  kind: "enum";
  options: EnumOption[] | { provider: string };
  default?: string | null;
}

export interface BooleanParamDef extends ParamBase {
  kind: "boolean";
  default?: boolean;
}

export interface StringParamDef extends ParamBase {
  kind: "string";
  default?: string;
}

export type ParamDef = NumberParamDef | EnumParamDef | BooleanParamDef | StringParamDef;

/** Punto de conexión de un elemento. */
export interface PortDef {
  id: string;
  label: string;
  /** Lado preferente en el símbolo, con el elemento sin rotar. */
  side: "top" | "bottom" | "left" | "right";
  /** Número máximo de conexiones; `null` = ilimitado (barras, tableros). Por defecto 1. */
  maxConnections?: number | null;
}

export type ElementCategory = "fuente" | "transformacion" | "distribucion" | "carga";

/**
 * Papel topológico del elemento. El motor lo usa para construir la red:
 * - source: inyecta potencia (acometida, generador).
 * - bus: nodo con muchas conexiones (tablero, CCM, barra).
 * - branch: impedancia serie entre dos nodos (cable).
 * - switch: puede abrir o cerrar el camino (interruptor, ATS).
 * - transformer: cambia el nivel de tensión.
 * - converter: equipo en serie con pérdidas (UPS, variador).
 * - load: consume potencia.
 */
export type ElectricalRole = "source" | "bus" | "branch" | "switch" | "transformer" | "converter" | "load";

/** Formato del consecutivo de la etiqueta automática: 1, 01 o A. */
export type TagStyle = "number" | "number2" | "letter";

export interface ElementTypeDefinition {
  /** Identificador estable que se guarda en el archivo de proyecto. No cambiarlo nunca. */
  type: string;
  name: string;
  description?: string;
  category: ElementCategory;
  electricalRole: ElectricalRole;
  ports: PortDef[];
  params: ParamDef[];
  tag: { prefix: string; style: TagStyle };
  /** Clave del símbolo en cada simbología. El dibujo vive en el paquete de símbolos. */
  symbols: { ANSI: string; IEC: string };
  /** Comportamiento de cálculo que el motor resuelve por este identificador. */
  calcBehavior: string;
}
