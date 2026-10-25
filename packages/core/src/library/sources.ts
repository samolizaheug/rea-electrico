import type { ElementTypeDefinition } from "../registry/definition";
import { efficiencyParam, powerFactorParam, systemParam, voltageParam } from "./common";

/** Red de suministro (acometida). Fuente de referencia (slack) del flujo de carga. */
export const utility: ElementTypeDefinition = {
  type: "utility",
  name: "Red de suministro (acometida)",
  category: "fuente",
  electricalRole: "source",
  ports: [{ id: "out", label: "Salida", side: "bottom", voltage: { param: "voltageV", system: "system" } }],
  tag: { prefix: "ACOM", style: "number" },
  symbols: { ANSI: "ansi/utility", IEC: "iec/utility" },
  calcBehavior: "source.slack",
  params: [
    voltageParam("voltageV", "Tensión nominal", 23000),
    systemParam("3F3H"),
    {
      key: "operatingVoltagePu",
      label: "Tensión de operación",
      kind: "number",
      unit: "pu",
      default: 1,
      min: 0.8,
      max: 1.2,
      required: true,
      group: "Eléctrico",
      description: "Tensión en el punto de suministro respecto a la nominal (1.00 = nominal).",
    },
    {
      key: "shortCircuitMVA",
      label: "Potencia de cortocircuito",
      kind: "number",
      unit: "MVA",
      default: null,
      min: 0,
      minExclusive: true,
      group: "Cortocircuito (fase posterior)",
      description: "Dato del suministrador. Se usa también como impedancia equivalente de la red en el flujo de carga si se captura.",
    },
    {
      key: "xrRatio",
      label: "Relación X/R de la red",
      kind: "number",
      default: null,
      min: 0,
      minExclusive: true,
      group: "Cortocircuito (fase posterior)",
    },
  ],
};

/** Generador. En la fase 1 actúa como fuente de tensión cuando alimenta una isla (p. ej. vía ATS). */
export const generator: ElementTypeDefinition = {
  type: "generator",
  name: "Generador",
  category: "fuente",
  electricalRole: "source",
  ports: [{ id: "out", label: "Salida", side: "bottom", voltage: { param: "voltageV", system: "system" } }],
  tag: { prefix: "GE", style: "number" },
  symbols: { ANSI: "ansi/generator", IEC: "iec/generator" },
  calcBehavior: "source.slack",
  params: [
    { key: "ratedKVA", label: "Capacidad", kind: "number", unit: "kVA", default: 100, min: 0, minExclusive: true, required: true, group: "Eléctrico" },
    voltageParam("voltageV", "Tensión nominal", 220),
    systemParam("3F4H"),
    powerFactorParam(0.8, "ratedPowerFactor", "Factor de potencia nominal"),
    {
      key: "operatingVoltagePu",
      label: "Tensión de operación",
      kind: "number",
      unit: "pu",
      default: 1,
      min: 0.8,
      max: 1.2,
      required: true,
      group: "Eléctrico",
    },
    {
      key: "subtransientReactancePct",
      label: "Reactancia subtransitoria X''d",
      kind: "number",
      unit: "%",
      default: null,
      min: 0,
      minExclusive: true,
      group: "Cortocircuito (fase posterior)",
    },
  ],
};

/** UPS. Equipo en serie: toma potencia de la entrada y la entrega a la salida con su eficiencia. */
export const ups: ElementTypeDefinition = {
  type: "ups",
  name: "UPS",
  category: "fuente",
  electricalRole: "converter",
  ports: [
    { id: "in", label: "Entrada", side: "top", voltage: { param: "inputVoltageV", system: "inputSystem" } },
    { id: "out", label: "Salida", side: "bottom", voltage: { param: "outputVoltageV", system: "system" } },
  ],
  internalLinks: [{ a: "in", b: "out", directional: true }],
  tag: { prefix: "UPS", style: "number" },
  symbols: { ANSI: "ansi/ups", IEC: "iec/ups" },
  calcBehavior: "converter.ups",
  params: [
    { key: "ratedKVA", label: "Capacidad", kind: "number", unit: "kVA", default: 10, min: 0, minExclusive: true, required: true, group: "Eléctrico" },
    voltageParam("inputVoltageV", "Tensión de entrada", 220),
    systemParam("3F4H", undefined, "inputSystem"),
    voltageParam("outputVoltageV", "Tensión de salida", 220),
    systemParam("3F4H", undefined, "system"),
    efficiencyParam(95),
    powerFactorParam(0.95, "inputPowerFactor", "Factor de potencia de entrada"),
  ],
};

export const sourceTypes = [utility, generator, ups];
