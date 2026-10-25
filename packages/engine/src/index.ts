/**
 * @rea/engine — motor de cálculo. Independiente de la interfaz y de la norma:
 * la norma entra como un `NormModule`.
 */
export * from "./norm-module";
export * from "./topology/validate";
export * from "./criteria";
export * from "./trace";
export { Complex } from "./calc/complex";
export { buildIslands, type Island, type NetEdge, type NetNode } from "./calc/network";
export * from "./calc/loadflow";
export * from "./calc/sizing";
export * from "./calc/schedules";
export { DisjointSets } from "./topology/dsu";
