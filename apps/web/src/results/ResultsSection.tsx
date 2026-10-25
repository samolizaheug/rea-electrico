import { elementReport } from "@rea/reports/src/data";
import { t } from "../i18n";
import { registry } from "../state/registry";
import { useValidation } from "../state/validation";

/**
 * Resultados y memoria de cálculo del elemento seleccionado (método nominal).
 * Usa los mismos datos que la memoria exportada en PDF y Excel.
 */
export function ResultsSection({ elementId }: { elementId: string }) {
  const v = useValidation();
  if (!v.results) return <p className="muted small">{t("results.notCalculated")}</p>;
  const report = elementReport(elementId, v.results.sizing, registry);
  if (!report) return <p className="muted small">{t("results.none")}</p>;

  return (
    <div className="results">
      <dl className="facts">
        {report.facts.map(([k, val]) => (
          <div key={k} className="fact">
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <h3>{t("results.memoria")}</h3>
      {report.traces.map((tr, i) => (
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
