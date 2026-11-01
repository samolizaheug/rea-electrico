import { useReactFlow } from "@xyflow/react";
import { useEffect, useState } from "react";
import { t } from "../i18n";
import { canSearchFix, hintFor, searchFixes, type Fix } from "../state/fixes";
import { useEditor, useProject } from "../state/store";
import { useValidation, type UiIssue } from "../state/validation";

/** Resultado de buscar una corrección: buscando, sin resultado o la lista de cambios que la resuelven. */
type Search = "searching" | Fix[];

/**
 * Lista de observaciones de validación. Cada una trae cómo resolverla, un botón para ir al elemento y,
 * cuando hay un cambio directo, la corrección probada con el mismo cálculo, lista para aplicar.
 */
export function IssuesPanel({ onClose }: { onClose(): void }) {
  const v = useValidation();
  const project = useProject();
  const flow = useReactFlow();
  const [found, setFound] = useState<Map<string, Search>>(new Map());
  // Si el proyecto cambia, las correcciones encontradas ya no están probadas: se vuelven a buscar.
  useEffect(() => setFound(new Map()), [v]);
  const keyOf = (i: UiIssue) => `${i.code ?? ""}|${i.message}`;
  const focus = (ids: string[]) => {
    useEditor.getState().select({ elements: ids, connections: [] });
    if (ids.length) flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.8, duration: 300, maxZoom: 1.5 });
  };
  const search = (i: UiIssue) => {
    const k = keyOf(i);
    setFound((m) => new Map(m).set(k, "searching"));
    // Se deja pintar «Buscando…» antes de correr los cálculos de prueba.
    setTimeout(() => {
      const p = useEditor.getState().history.present;
      const fixes = searchFixes(i, p, v);
      setFound((m) => new Map(m).set(k, fixes));
    }, 30);
  };

  return (
    <section className="issues-panel" aria-label={t("issues.title")}>
      <header>
        <strong>{t("issues.title")}</strong>
        <span className="muted">{t("issues.summary", { errors: v.errors, warnings: v.warnings })}</span>
        <button onClick={onClose}>{t("issues.close")}</button>
      </header>
      {v.issues.length === 0 ? (
        <p className="muted">{t("issues.none")}</p>
      ) : (
        <ul>
          {v.issues.map((i, n) => {
            const s = found.get(keyOf(i));
            return (
              <li key={`${n}-${i.message}`} className="issue-item">
                <button className={`issue ${i.severity}`} onClick={() => focus(i.elementIds)}>
                  <span className="dot" aria-hidden />
                  <span className="origin">{t(`issues.${i.origin}`)}</span>
                  <span>{i.message}</span>
                </button>
                <div className="issue-help">
                  <p>
                    <strong>{t("issues.how")}</strong> {hintFor(i, project)}
                  </p>
                  <div className="issue-actions">
                    {i.elementIds.length ? (
                      <button type="button" onClick={() => focus(i.elementIds)}>
                        {t("issues.goTo")}
                      </button>
                    ) : null}
                    {canSearchFix(i) && s === undefined ? (
                      <button type="button" onClick={() => search(i)}>
                        {t("issues.search")}
                      </button>
                    ) : null}
                    {s === "searching" ? <span className="muted">{t("issues.searching")}</span> : null}
                    {Array.isArray(s)
                      ? s.length
                        ? s.map((f) => (
                            <button key={f.label} type="button" className="primary" title={t("issues.fixHelp")} onClick={() => useEditor.getState().applyFix(f.label, f.apply)}>
                              {t("issues.apply", { label: f.label })}
                            </button>
                          ))
                        : <span className="muted">{t("issues.noFix")}</span>
                      : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
