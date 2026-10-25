import type { ElementTypeDefinition } from "../registry/definition";
import { efficiencyParam, loadCommonParams, powerFactorParam, voltageParam } from "./common";

/** Marca de equipo electrónico sensible: límites obligatorios de caída de tensión (NOM 647-4(d)). */
const sensitiveParam = {
  key: "sensitiveElectronic",
  label: "Equipo electrónico sensible (Art. 647)",
  kind: "boolean" as const,
  default: false,
  group: "Carga",
  description: "Circuitos para equipo electrónico sensible: caída máxima 1.5 % en el circuito derivado y 2.5 % combinada (NOM-001-SEDE-2012 647-4(d)).",
};

const loadPort = [{ id: "in", label: "Alimentación", side: "top" as const, voltage: { param: "voltageV", system: "system", phase: "phase" } }];

/** Motor. La corriente para dimensionar se toma de la tabla de la norma (NOM 430-6(a)(1)) salvo que se indique placa. */
export const motor: ElementTypeDefinition = {
  type: "motor",
  name: "Motor",
  category: "carga",
  electricalRole: "load",
  ports: loadPort,
  tag: { prefix: "M", style: "number2" },
  symbols: { ANSI: "ansi/motor", IEC: "iec/motor" },
  calcBehavior: "load.motor",
  params: [
    { key: "ratedPower", label: "Potencia nominal", kind: "number", default: 10, min: 0, minExclusive: true, required: true, group: "Placa" },
    {
      key: "ratedPowerUnit",
      label: "Unidad de potencia",
      kind: "enum",
      options: [
        { value: "hp", label: "hp" },
        { value: "kW", label: "kW" },
      ],
      default: "hp",
      required: true,
      group: "Placa",
    },
    voltageParam("voltageV", "Tensión nominal del motor", 220),
    ...loadCommonParams("3F3H", "ABC"),
    {
      key: "motorType",
      label: "Tipo de motor",
      kind: "enum",
      options: [
        { value: "jaula", label: "Inducción jaula de ardilla" },
        { value: "jaula-b-eficiente", label: "Jaula de ardilla, diseño B energéticamente eficiente" },
        { value: "rotor-devanado", label: "Rotor devanado" },
        { value: "sincrono", label: "Síncrono" },
        { value: "cc", label: "Corriente continua" },
      ],
      default: "jaula",
      required: true,
      group: "Placa",
    },
    {
      key: "currentSource",
      label: "Corriente para cálculo",
      kind: "enum",
      options: [
        { value: "tabla", label: "Tabla de la norma" },
        { value: "placa", label: "Dato de placa" },
      ],
      default: "tabla",
      required: true,
      group: "Placa",
    },
    {
      key: "nameplateCurrentA",
      label: "Corriente de placa",
      kind: "number",
      unit: "A",
      default: null,
      min: 0,
      minExclusive: true,
      group: "Placa",
      description: "Obligatoria si la corriente se toma de placa. Se usa además para la protección contra sobrecarga.",
    },
    efficiencyParam(null),
    powerFactorParam(0.85),
    {
      key: "serviceFactor",
      label: "Factor de servicio",
      kind: "number",
      default: 1.15,
      min: 1,
      max: 2,
      group: "Placa",
    },
    {
      key: "designLetter",
      label: "Letra de diseño",
      kind: "enum",
      options: [
        { value: "B", label: "B" },
        { value: "C", label: "C" },
        { value: "D", label: "D" },
        { value: "E", label: "E" },
        { value: "desconocida", label: "No indicada" },
      ],
      default: "B",
      required: true,
      group: "Placa",
    },
    {
      key: "starting",
      label: "Tipo de arranque",
      kind: "enum",
      options: [
        { value: "directo", label: "A tensión plena" },
        { value: "estrella-delta", label: "Estrella-delta" },
        { value: "autotransformador", label: "Autotransformador" },
        { value: "arrancador-suave", label: "Arrancador suave" },
        { value: "variador", label: "Variador de frecuencia" },
      ],
      default: "directo",
      required: true,
      group: "Operación",
    },
    {
      key: "firePump",
      label: "Bomba contra incendio",
      kind: "boolean",
      default: false,
      group: "Operación",
      description: "Aplica los límites obligatorios de caída de tensión de bombas contra incendio (NOM-001-SEDE-2012 695-7).",
    },
    {
      key: "dutyClass",
      label: "Régimen de servicio",
      kind: "enum",
      options: [
        { value: "continuo", label: "Continuo" },
        { value: "corta-duracion", label: "Corta duración" },
        { value: "intermitente", label: "Intermitente" },
        { value: "periodico", label: "Periódico" },
        { value: "variable", label: "Variable" },
      ],
      default: "continuo",
      required: true,
      group: "Operación",
    },
    {
      key: "dutyRating",
      label: "Especificación de tiempo del motor",
      kind: "enum",
      options: [
        { value: "5min", label: "5 minutos" },
        { value: "15min", label: "15 minutos" },
        { value: "30-60min", label: "30 y 60 minutos" },
        { value: "continuo", label: "Funcionamiento continuo" },
      ],
      default: "continuo",
      required: true,
      group: "Operación",
      visibleWhen: { param: "dutyClass", equals: ["corta-duracion", "intermitente", "periodico", "variable"] },
    },
  ],
};

/** Variador de frecuencia: en serie entre el alimentador y el motor. */
export const vfd: ElementTypeDefinition = {
  type: "vfd",
  name: "Variador de frecuencia",
  category: "carga",
  electricalRole: "converter",
  ports: [
    { id: "in", label: "Entrada", side: "top", voltage: { param: "inputVoltageV" } },
    { id: "out", label: "Salida al motor", side: "bottom" },
  ],
  internalLinks: [{ a: "in", b: "out", directional: true }],
  tag: { prefix: "VFD", style: "number2" },
  symbols: { ANSI: "ansi/vfd", IEC: "iec/vfd" },
  calcBehavior: "converter.vfd",
  params: [
    voltageParam("inputVoltageV", "Tensión de entrada", 220),
    { key: "ratedInputCurrentA", label: "Corriente nominal de entrada", kind: "number", unit: "A", default: null, min: 0, minExclusive: true, group: "Placa" },
    efficiencyParam(97),
    powerFactorParam(0.95, "inputPowerFactor", "Factor de potencia de entrada"),
  ],
};

/** Contactos (receptáculos), agrupados por circuito. */
export const receptacle: ElementTypeDefinition = {
  type: "receptacle",
  name: "Contactos",
  category: "carga",
  electricalRole: "load",
  ports: loadPort,
  tag: { prefix: "C", style: "number2" },
  symbols: { ANSI: "ansi/receptacle", IEC: "iec/receptacle" },
  calcBehavior: "load.receptacle",
  params: [
    { key: "quantity", label: "Cantidad de salidas", kind: "number", default: 1, min: 1, integer: true, required: true, group: "Carga" },
    {
      key: "vaPerOutlet",
      label: "Carga por salida",
      kind: "number",
      unit: "VA",
      default: 180,
      min: 0,
      minExclusive: true,
      required: true,
      group: "Carga",
      description: "NOM 220-14(i): 180 VA por salida sencilla o múltiple en un mismo yugo (verificar para el caso).",
    },
    powerFactorParam(0.9),
    voltageParam("voltageV", "Tensión nominal", 127),
    ...loadCommonParams("1F2H", "A"),
    sensitiveParam,
  ],
};

/** Luminarias, agrupadas por circuito. */
export const luminaire: ElementTypeDefinition = {
  type: "luminaire",
  name: "Luminarias",
  category: "carga",
  electricalRole: "load",
  ports: loadPort,
  tag: { prefix: "L", style: "number2" },
  symbols: { ANSI: "ansi/luminaire", IEC: "iec/luminaire" },
  calcBehavior: "load.lighting",
  params: [
    { key: "quantity", label: "Cantidad", kind: "number", default: 1, min: 1, integer: true, required: true, group: "Carga" },
    { key: "wattsPerUnit", label: "Potencia por luminaria", kind: "number", unit: "W", default: 40, min: 0, minExclusive: true, required: true, group: "Carga" },
    powerFactorParam(0.9),
    voltageParam("voltageV", "Tensión nominal", 127),
    ...loadCommonParams("1F2H", "A"),
  ],
};

/** Carga genérica definida por su potencia. */
export const genericLoad: ElementTypeDefinition = {
  type: "generic-load",
  name: "Carga genérica",
  category: "carga",
  electricalRole: "load",
  ports: loadPort,
  tag: { prefix: "CG", style: "number2" },
  symbols: { ANSI: "ansi/generic-load", IEC: "iec/generic-load" },
  calcBehavior: "load.generic",
  params: [
    { key: "power", label: "Potencia", kind: "number", default: 5, min: 0, minExclusive: true, required: true, group: "Carga" },
    {
      key: "powerUnit",
      label: "Unidad de potencia",
      kind: "enum",
      options: [
        { value: "kW", label: "kW" },
        { value: "kVA", label: "kVA" },
      ],
      default: "kW",
      required: true,
      group: "Carga",
    },
    powerFactorParam(0.9),
    voltageParam("voltageV", "Tensión nominal", 220),
    ...loadCommonParams("3F4H", "ABC"),
    {
      key: "nonLinear",
      label: "Carga no lineal",
      kind: "boolean",
      default: false,
      group: "Carga",
      description: "Si la mayor parte de la carga es no lineal, el neutro cuenta como conductor portador de corriente (NOM 310-15(b)(5)).",
    },
    sensitiveParam,
  ],
};

/** Carga agrupada: representa un conjunto de cargas con su potencia instalada total. */
export const groupedLoad: ElementTypeDefinition = {
  type: "grouped-load",
  name: "Carga agrupada",
  category: "carga",
  electricalRole: "load",
  ports: loadPort,
  tag: { prefix: "CA", style: "number2" },
  symbols: { ANSI: "ansi/grouped-load", IEC: "iec/grouped-load" },
  calcBehavior: "load.generic",
  params: [
    { key: "description", label: "Descripción", kind: "string", default: "", group: "Carga" },
    { key: "power", label: "Potencia instalada", kind: "number", default: 10, min: 0, minExclusive: true, required: true, group: "Carga" },
    {
      key: "powerUnit",
      label: "Unidad de potencia",
      kind: "enum",
      options: [
        { value: "kW", label: "kW" },
        { value: "kVA", label: "kVA" },
      ],
      default: "kVA",
      required: true,
      group: "Carga",
    },
    powerFactorParam(0.9),
    voltageParam("voltageV", "Tensión nominal", 220),
    ...loadCommonParams("3F4H", "ABC"),
    { key: "nonLinear", label: "Carga no lineal", kind: "boolean", default: false, group: "Carga" },
    sensitiveParam,
  ],
};

export const loadTypes = [motor, vfd, receptacle, luminaire, genericLoad, groupedLoad];
