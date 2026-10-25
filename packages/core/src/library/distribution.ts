import type { ElementTypeDefinition, ParamDef } from "../registry/definition";
import { systemParam, voltageParam } from "./common";

const busPort = [{ id: "bus", label: "Barra", side: "bottom" as const, maxConnections: null, voltage: { param: "voltageV", system: "system" } }];

function boardParams(defaultUse: string): ParamDef[] {
  return [
    voltageParam("voltageV", "Tensión nominal", 220),
    systemParam("3F4H"),
    {
      key: "busRatingA",
      label: "Capacidad de barras",
      kind: "number",
      unit: "A",
      default: null,
      min: 0,
      minExclusive: true,
      group: "Equipo",
    },
    {
      key: "boardUse",
      label: "Uso",
      kind: "enum",
      options: [
        { value: "distribucion", label: "Distribución" },
        { value: "alumbrado-contactos", label: "Alumbrado y contactos" },
        { value: "fuerza", label: "Fuerza" },
      ],
      default: defaultUse,
      required: true,
      group: "Equipo",
    },
    {
      key: "ratedFor100Pct",
      label: "Ensamble aprobado para operar al 100 %",
      kind: "boolean",
      default: false,
      group: "Equipo",
      description: "Habilita las excepciones de 210-19(a)(1), 210-20(a), 215-2(a)(1) y 215-3 (sin el 125 % de carga continua).",
    },
  ];
}

/** Tablero (de distribución, de alumbrado y contactos o de fuerza). */
export const panelboard: ElementTypeDefinition = {
  type: "panelboard",
  name: "Tablero",
  category: "distribucion",
  electricalRole: "bus",
  ports: busPort,
  tag: { prefix: "TAB", style: "letter" },
  symbols: { ANSI: "ansi/panelboard", IEC: "iec/panelboard" },
  calcBehavior: "bus.board",
  params: boardParams("alumbrado-contactos"),
};

/** Centro de control de motores. */
export const mcc: ElementTypeDefinition = {
  type: "mcc",
  name: "Centro de control de motores (CCM)",
  category: "distribucion",
  electricalRole: "bus",
  ports: busPort,
  tag: { prefix: "CCM", style: "number" },
  symbols: { ANSI: "ansi/mcc", IEC: "iec/mcc" },
  calcBehavior: "bus.board",
  params: boardParams("fuerza"),
};

/** Barra (nodo eléctrico simple, sin envolvente). */
export const busbar: ElementTypeDefinition = {
  type: "busbar",
  name: "Barra",
  category: "distribucion",
  electricalRole: "bus",
  ports: busPort,
  tag: { prefix: "B", style: "number" },
  symbols: { ANSI: "ansi/busbar", IEC: "iec/busbar" },
  calcBehavior: "bus.plain",
  params: [
    voltageParam("voltageV", "Tensión nominal", 220),
    systemParam("3F4H"),
    { key: "ratingA", label: "Capacidad", kind: "number", unit: "A", default: null, min: 0, minExclusive: true, group: "Equipo" },
  ],
};

/** Interruptor automático o fusible. Su capacidad nominal la selecciona el módulo normativo si no se fija. */
export const breaker: ElementTypeDefinition = {
  type: "breaker",
  name: "Interruptor / protección",
  category: "distribucion",
  electricalRole: "switch",
  ports: [
    { id: "line", label: "Línea", side: "top" },
    { id: "load", label: "Carga", side: "bottom" },
  ],
  internalLinks: [{ a: "line", b: "load", when: { param: "state", equals: "cerrado" } }],
  voltageTransparent: true,
  tag: { prefix: "INT", style: "number" },
  symbols: { ANSI: "ansi/breaker", IEC: "iec/breaker" },
  calcBehavior: "switch.protective",
  params: [
    {
      key: "deviceType",
      label: "Tipo de dispositivo",
      kind: "enum",
      options: [
        { value: "itm", label: "Interruptor termomagnético (tiempo inverso)" },
        { value: "electronico", label: "Interruptor de disparo ajustable" },
        { value: "instantaneo", label: "Interruptor de disparo instantáneo" },
        { value: "fusible-sin-retardo", label: "Fusible sin retardo de tiempo" },
        { value: "fusible-doble-elemento", label: "Fusible de dos elementos (con retardo)" },
      ],
      default: "itm",
      required: true,
      group: "Equipo",
    },
    {
      key: "poles",
      label: "Polos",
      kind: "enum",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
      ],
      default: "3",
      required: true,
      group: "Equipo",
    },
    {
      key: "forcedRatingA",
      label: "Capacidad nominal fijada",
      kind: "number",
      unit: "A",
      default: null,
      min: 0,
      minExclusive: true,
      group: "Equipo",
      description: "Vacío = la selecciona el cálculo con las capacidades estándar de la norma.",
    },
    {
      key: "state",
      label: "Estado",
      kind: "enum",
      options: [
        { value: "cerrado", label: "Cerrado" },
        { value: "abierto", label: "Abierto" },
      ],
      default: "cerrado",
      required: true,
      group: "Operación",
    },
  ],
};

/** Transferencia automática (ATS): conecta la carga a la fuente normal o a la de emergencia. */
export const ats: ElementTypeDefinition = {
  type: "ats",
  name: "Transferencia (ATS)",
  category: "distribucion",
  electricalRole: "switch",
  ports: [
    { id: "normal", label: "Normal", side: "top" },
    { id: "emergency", label: "Emergencia", side: "right" },
    { id: "load", label: "Carga", side: "bottom" },
  ],
  internalLinks: [
    { a: "normal", b: "load", when: { param: "position", equals: "normal" } },
    { a: "emergency", b: "load", when: { param: "position", equals: "emergencia" } },
  ],
  voltageTransparent: true,
  tag: { prefix: "ATS", style: "number" },
  symbols: { ANSI: "ansi/ats", IEC: "iec/ats" },
  calcBehavior: "switch.transfer",
  params: [
    { key: "ratedA", label: "Capacidad", kind: "number", unit: "A", default: null, min: 0, minExclusive: true, group: "Equipo" },
    {
      key: "position",
      label: "Posición",
      kind: "enum",
      options: [
        { value: "normal", label: "Normal" },
        { value: "emergencia", label: "Emergencia" },
      ],
      default: "normal",
      required: true,
      group: "Operación",
    },
  ],
};

/** Alimentador / circuito (cable). La norma activa provee las opciones de aislamiento, método y calibres. */
export const cable: ElementTypeDefinition = {
  type: "cable",
  name: "Alimentador (cable)",
  category: "distribucion",
  electricalRole: "branch",
  ports: [
    { id: "from", label: "Origen", side: "top" },
    { id: "to", label: "Destino", side: "bottom" },
  ],
  internalLinks: [{ a: "from", b: "to" }],
  voltageTransparent: true,
  tag: { prefix: "AL", style: "number" },
  symbols: { ANSI: "ansi/cable", IEC: "iec/cable" },
  calcBehavior: "branch.cable",
  params: [
    { key: "lengthM", label: "Longitud", kind: "number", unit: "m", default: 10, min: 0, minExclusive: true, required: true, group: "Trayectoria" },
    {
      key: "material",
      label: "Material del conductor",
      kind: "enum",
      options: [
        { value: "Cu", label: "Cobre" },
        { value: "Al", label: "Aluminio" },
      ],
      default: "Cu",
      required: true,
      group: "Conductor",
    },
    {
      key: "insulationType",
      label: "Tipo de aislamiento",
      kind: "enum",
      options: { provider: "norm:insulationTypes" },
      default: null,
      required: true,
      group: "Conductor",
      description: "Define la temperatura nominal del conductor según la tabla de la norma activa.",
    },
    {
      key: "installationMethod",
      label: "Método de instalación / canalización",
      kind: "enum",
      options: { provider: "norm:installationMethods" },
      default: null,
      required: true,
      group: "Trayectoria",
    },
    {
      key: "racewaySize",
      label: "Medida de la canalización",
      kind: "enum",
      options: { provider: "norm:racewaySizes" },
      default: null,
      group: "Trayectoria",
      description: "Medidas comerciales del tipo de canalización elegido (tubo: Capítulo 10 Tabla 4; charola: Tabla 392-22(a)). Se usa para el llenado en fases posteriores.",
    },
    {
      key: "trayCableType",
      label: "Tipo de cable en charola",
      kind: "enum",
      options: [
        { value: "multiconductor", label: "Cable multiconductor" },
        { value: "unipolar", label: "Cables de un solo conductor" },
      ],
      default: "multiconductor",
      required: true,
      group: "Trayectoria",
      visibleWhen: { param: "installationMethod", equals: ["charola-escalera", "charola-fondo-solido"] },
      description: "Define la regla de ampacidad en charolas portacables (NOM 392-80(a)(1) o (a)(2)).",
    },
    {
      key: "trayCovered",
      label: "Charola con tapa sólida sin ventilación (más de 1.80 m)",
      kind: "boolean",
      default: false,
      group: "Trayectoria",
      visibleWhen: { param: "installationMethod", equals: ["charola-escalera", "charola-fondo-solido"] },
    },
    {
      key: "conductorsPerPhase",
      label: "Conductores por fase (paralelo)",
      kind: "number",
      default: 1,
      min: 1,
      max: 12,
      integer: true,
      required: true,
      group: "Conductor",
    },
    {
      key: "ambientTempC",
      label: "Temperatura ambiente",
      kind: "number",
      unit: "°C",
      default: null,
      min: -40,
      max: 90,
      group: "Trayectoria",
      description: "Vacío = temperatura ambiente por defecto del proyecto.",
    },
    {
      key: "groupedConductors",
      label: "Conductores portadores de corriente en la canalización",
      kind: "number",
      default: null,
      min: 1,
      integer: true,
      group: "Trayectoria",
      description: "Total en la misma canalización o cable, incluidos otros circuitos. Vacío = solo los de este alimentador.",
    },
    {
      key: "terminalTempC",
      label: "Temperatura de terminales",
      kind: "enum",
      options: [
        { value: "auto", label: "Automática (según norma)" },
        { value: "60", label: "60 °C" },
        { value: "75", label: "75 °C" },
        { value: "90", label: "90 °C" },
      ],
      default: "auto",
      required: true,
      group: "Conductor",
    },
    {
      key: "circuitKind",
      label: "Tipo de circuito",
      kind: "enum",
      options: [
        { value: "auto", label: "Automático (por topología)" },
        { value: "alimentador", label: "Alimentador" },
        { value: "derivado", label: "Circuito derivado" },
      ],
      default: "auto",
      required: true,
      group: "Trayectoria",
      description: "Determina el límite de caída de tensión del tramo.",
    },
    {
      key: "forcedSize",
      label: "Calibre fijado",
      kind: "enum",
      options: { provider: "norm:conductorSizes" },
      default: null,
      group: "Conductor",
      description: "Vacío = el cálculo selecciona el calibre mínimo que cumple todos los criterios.",
    },
    {
      key: "includeEgc",
      label: "Incluir conductor de puesta a tierra de equipos",
      kind: "boolean",
      default: true,
      group: "Conductor",
    },
  ],
};

export const distributionTypes = [panelboard, mcc, busbar, breaker, ats, cable];
