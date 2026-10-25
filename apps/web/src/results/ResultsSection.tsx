import type { Trace } from "@rea/engine";
import { t } from "../i18n";
import { useValidation } from "../state/validation";
import { f1 } from "./format";

/** Resultados y memoria de cálculo del elemento seleccionado (método nominal). */
export function ResultsSection({ elementId }: { elementId: string }) {
  const v = useValidation();
  if (!v.results) return <p className="muted small">{t("results.notCalculated")}</p>;
  const flow = v.results.flow(elementId);
  const circuit = v.results.sizing.circuits.get(elementId);
  const asBreaker = [...v.results.sizing.circuits.values()].find((c) => c.breakerId === elementId);
  if (!flow && !circuit && !asBreaker) return <p className="muted small">{t("results.none")}</p>;

  const rows: [string, string][] = [];
  if (flow?.currentA !== undefined) rows.push([t("results.current"), `${f1(flow.currentA, 2)} A`]);
  if (flow?.currentSecondaryA !== undefined) rows.push([t("results.currentSecondary"), `${f1(flow.currentSecondaryA, 2)} A`]);
  if (flow?.power) rows.push([t("results.power"), `${f1(flow.power.pKW, 3)} kW · ${f1(flow.power.qKvar, 3)} kvar · ${f1(flow.power.sKVA, 3)} kVA · FP ${f1(flow.power.pf, 3)}`]);
  if (flow?.voltage) rows.push([t("results.voltage"), `${f1(flow.voltage.v, 1)} V (${f1(flow.voltage.pct, 2)} % de ${f1(flow.voltage.vNom, 1)} V ${flow.voltage.basis})`]);
  if (flow?.dropPct !== undefined) rows.push([t("results.drop"), `${f1(flow.dropPct, 3)} %`]);
  if (flow?.cumulativeDropPct !== undefined) rows.push([t("results.cumulative"), `${f1(flow.cumulativeDropPct, 3)} %`]);
  if (circuit) {
    const c = circuit.conductor;
    rows.push([t("results.designCurrent"), `${f1(circuit.protection.designA, 2)} A (${circuit.protection.rule})`]);
    rows.push([t("results.conductor"), `${c.conductorsPerPhase > 1 ? `${c.conductorsPerPhase} × ` : ""}${c.designation} ${c.system} ${c.material} — ${f1(c.ampacityA, 1)} A (rige: ${t(`governing.${c.governing}`)})`]);
    if (c.egc) rows.push([t("results.egc"), `${c.egc.designation} ${c.egc.system}${c.egc.perRaceway ? " en cada canalización" : ""}`]);
    if (circuit.protection.ratingA !== undefined) rows.push([t("results.protection"), `${circuit.protection.ratingA} A`]);
  }
  if (asBreaker) rows.push([t("results.protection"), `${asBreaker.protection.ratingA ?? "—"} A (${asBreaker.protection.rule})`]);

  const traces: Trace[] = [
    ...(circuit ? [{ title: t("results.sizingTrace"), steps: [...circuit.protection.steps, ...circuit.conductor.steps] }] : []),
    ...(asBreaker ? [{ title: t("results.protectionTrace"), steps: asBreaker.protection.steps }] : []),
    ...(flow?.traces ?? []),
  ];

  return (
    <div className="results">
      <dl className="facts">
        {rows.map(([k, val]) => (
          <div key={k} className="fact">
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <h3>{t("results.memoria")}</h3>
      {traces.map((tr, i) => (
        <details key={`${tr.title}-${i}`} className="trace" open={i === 0}>
          <summary>{tr.title}</summary>
          <ol>
            {tr.steps.map((s, j) => (
              <li key={j}>
                <div className="step-label">{s.label}</div>
                {s.formula ? <div className="step-formula">{s.formula}</div> : null}
                {s.substitution ? <div className="step-sub">{s.substitution}</div> : null}
                <div className="step-result">{s.result}</div>
                {s.refs?.length ? <div className="step-refs">{s.refs.join(" · ")}</div> : null}
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}
