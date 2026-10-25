import { isParamActive } from "@rea/core";
import { useMemo, useState } from "react";
import { Control } from "../editor/fields";
import { t } from "../i18n";
import { registry } from "../state/registry";
import { useEditor, useProject } from "../state/store";
import { useValidation } from "../state/validation";
import { f1, resultBadge } from "./format";

/** Vista en tabla: todos los elementos de un tipo, con sus parámetros editables y sus resultados. */
export function TableView() {
  const project = useProject();
  const v = useValidation();
  const selection = useEditor((s) => s.selection);
  const ed = useEditor.getState();
  const types = useMemo(() => [...new Set(project.elements.map((e) => e.type))], [project.elements]);
  const [type, setType] = useState<string>(types.includes("cable") ? "cable" : types[0] ?? "");
  const current = types.includes(type) ? type : types[0] ?? "";
  if (!current) return <div className="table-view"><p className="muted">{t("table.empty")}</p></div>;

  const def = registry.get(current);
  const rows = project.elements.filter((e) => e.type === current).sort((a, b) => a.tag.localeCompare(b.tag, "es", { numeric: true }));
  const params = def.params.filter((p) => rows.some((r) => isParamActive(p, r.params)));

  return (
    <div className="table-view">
      <div className="table-toolbar">
        <label>
          {t("table.type")}{" "}
          <select value={current} onChange={(e) => setType(e.target.value)}>
            {types.map((tp) => (
              <option key={tp} value={tp}>
                {registry.get(tp).name} ({project.elements.filter((e) => e.type === tp).length})
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">{t("table.hint")}</span>
      </div>
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky">{t("inspector.tag")}</th>
              {params.map((p) => (
                <th key={p.key} title={p.description}>
                  {p.label}
                  {p.kind === "number" && p.unit ? <span className="unit"> ({p.unit === "pu" ? "p.u." : p.unit})</span> : null}
                </th>
              ))}
              <th>{t("table.results")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((el) => {
              const issue = v.byElement.get(el.id);
              const paramIssues = v.paramIssues.get(el.id) ?? [];
              return (
                <tr key={el.id} className={`${selection.elements.includes(el.id) ? "selected" : ""} ${issue ? `issue-${issue}` : ""}`}>
                  <th className="sticky">
                    <button className="link" onClick={() => ed.select({ elements: [el.id], connections: [] })}>
                      {el.tag}
                    </button>
                  </th>
                  {params.map((p) => {
                    const active = isParamActive(p, el.params);
                    const bad = paramIssues.some((i) => i.key === p.key && i.severity === "error");
                    return (
                      <td key={p.key} className={bad ? "invalid" : ""} title={paramIssues.find((i) => i.key === p.key)?.message}>
                        {active ? (
                          <Control
                            id={`t-${el.id}-${p.key}`}
                            def={p}
                            value={el.params[p.key] ?? null}
                            providerOptions={p.kind === "enum" && !Array.isArray(p.options) ? v.norm.options(p.options.provider, el.params) : undefined}
                            onCommit={(value) => ed.setParams(el.id, p.key === "installationMethod" ? { installationMethod: value, racewaySize: null } : { [p.key]: value })}
                          />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="result-cell">{v.results ? resultBadge(el.id, el.type, v.results).join(" · ") || "—" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t("table.footer", { n: rows.length, kva: f1(rows.reduce((s, r) => s + (v.results?.flow(r.id)?.power?.sKVA ?? 0), 0), 2) })}</p>
    </div>
  );
}
