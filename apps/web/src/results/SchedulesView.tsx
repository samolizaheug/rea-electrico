import { t } from "../i18n";
import { toDisplayLength } from "@rea/reports/src/units";
import { useEditor, useProject } from "../state/store";
import { useValidation } from "../state/validation";
import { f1 } from "./format";

/** Cuadros de carga por tablero, con balance por fase. */
export function SchedulesView() {
  const v = useValidation();
  const ed = useEditor.getState();
  const u = useProject().settings.units;
  if (!v.results) return <div className="schedules"><p className="muted">{t("results.notCalculated")}</p></div>;
  if (!v.results.schedules.length) return <div className="schedules"><p className="muted">{t("schedules.none")}</p></div>;

  return (
    <div className="schedules">
      {v.results.schedules.map((s) => {
        const ln = s.vNomLL / Math.sqrt(3);
        return (
          <section key={s.boardId} className="schedule">
            <header>
              <h3>
                <button className="link" onClick={() => ed.select({ elements: [s.boardId], connections: [] })}>
                  {s.tag}
                </button>
              </h3>
              <span className="muted">
                {f1(s.vNomLL, 0)}{s.system === "3F4H" ? `Y/${f1(ln, 0)}` : ""} V · {s.system}
              </span>
            </header>
            <div className="table-scroll">
              <table className="grid schedule-table">
                <thead>
                  <tr>
                    <th>{t("schedules.circuit")}</th>
                    <th>{t("schedules.description")}</th>
                    <th>{t("schedules.phases")}</th>
                    <th className="num">A (VA)</th>
                    <th className="num">B (VA)</th>
                    <th className="num">C (VA)</th>
                    <th className="num">{t("schedules.total")} (VA)</th>
                    <th className="num">I (A)</th>
                    <th className="num">{t("schedules.protection")}</th>
                    <th>{t("schedules.conductor")}</th>
                    <th className="num">L ({u.length})</th>
                    <th className="num">ΔV (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r) => (
                    <tr key={r.headId}>
                      <td>
                        <button className="link" onClick={() => ed.select({ elements: [r.headId], connections: [] })}>
                          {r.circuit}
                        </button>
                      </td>
                      <td>{r.description}</td>
                      <td>{r.phases}</td>
                      <td className="num">{f1(r.va.a, 0)}</td>
                      <td className="num">{f1(r.va.b, 0)}</td>
                      <td className="num">{f1(r.va.c, 0)}</td>
                      <td className="num">{f1(r.totalVA, 0)}</td>
                      <td className="num">{f1(r.currentA, 2)}</td>
                      <td className="num">{r.protectionA !== undefined ? `${r.protectionA} A${r.poles ? ` / ${r.poles}P` : ""}` : "—"}</td>
                      <td>{r.conductor ?? "—"}</td>
                      <td className="num">{f1(r.lengthM === undefined ? undefined : toDisplayLength(r.lengthM, u), 0)}</td>
                      <td className="num">{f1(r.dropPct, 2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>{t("schedules.totals")}</th>
                    <td className="num">{f1(s.totals.va.a, 0)}</td>
                    <td className="num">{f1(s.totals.va.b, 0)}</td>
                    <td className="num">{f1(s.totals.va.c, 0)}</td>
                    <td className="num">{f1(s.totals.totalVA, 0)}</td>
                    <td colSpan={5}>
                      {f1(s.totals.pKW, 2)} kW · {f1(s.totals.qKvar, 2)} kvar · FP {f1(s.totals.pf, 3)}
                    </td>
                  </tr>
                  <tr>
                    <th colSpan={3}>{t("schedules.phaseCurrent")}</th>
                    <td className="num">{f1(s.totals.currentA.a, 2)}</td>
                    <td className="num">{f1(s.totals.currentA.b, 2)}</td>
                    <td className="num">{f1(s.totals.currentA.c, 2)}</td>
                    <td colSpan={6}>
                      <span className={`unbalance${s.totals.unbalanceExceeded ? " warning" : ""}`}>
                        {t("schedules.unbalance")}: {f1(s.totals.unbalancePct, 2)} %
                        {s.totals.unbalanceLimitPct !== undefined ? ` (${t("schedules.unbalanceLimit", { max: s.totals.unbalanceLimitPct })})` : ""}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <ul className="notes">
              {s.notes.map((nt) => (
                <li key={nt}>{nt}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
