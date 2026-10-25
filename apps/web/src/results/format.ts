import type { ElementFlow } from "@rea/engine";
import type { Results } from "../state/validation";

export const f1 = (v: number | undefined, d = 1) => (v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }));

/** Resumen corto de resultados para mostrar junto al símbolo en el diagrama. */
export function resultBadge(elementId: string, type: string, results: Results): string[] {
  const flow: ElementFlow | undefined = results.flow(elementId);
  const circuit = results.sizing.circuits.get(elementId);
  const breakerOf = [...results.sizing.circuits.values()].find((c) => c.breakerId === elementId);
  switch (type) {
    case "cable": {
      if (!flow) return [];
      const c = circuit?.conductor;
      const size = c && c.designation !== "—" ? `${c.conductorsPerPhase > 1 ? `${c.conductorsPerPhase}×` : ""}${c.designation}${c.system === "AWG" ? " AWG" : c.system === "kcmil" ? " kcmil" : ""}` : "sin calibre";
      return [size, `${f1(flow.currentA)} A · ΔV ${f1(flow.dropPct, 2)} %`];
    }
    case "breaker": {
      const r = breakerOf?.protection.ratingA;
      return r !== undefined ? [`${r} A`] : [];
    }
    case "transformer":
      return flow ? [`${f1(flow.power?.sKVA)} kVA`, `ΔV ${f1(flow.dropPct, 2)} %`] : [];
    case "panelboard":
    case "mcc":
    case "busbar":
      return flow?.voltage ? [`${f1(flow.voltage.v)} V (${f1(flow.voltage.pct, 2)} %)`] : [];
    case "utility":
    case "generator":
      return flow ? [`${f1(flow.power?.sKVA)} kVA · ${f1(flow.currentA)} A`] : [];
    default:
      if (!flow) return [];
      return [`${f1(flow.currentA)} A · ${f1(flow.voltage?.pct, 1)} %`];
  }
}
