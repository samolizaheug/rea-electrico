import { isParamActive, type ProjectElement } from "@rea/core";
import { t } from "../i18n";
import { registry } from "../state/registry";
import { useEditor } from "../state/store";
import { useValidation } from "../state/validation";
import { ParamField, TextInput } from "./fields";

/** Panel de propiedades: se construye a partir de la definición del tipo de elemento. */
export function ElementProperties({ element }: { element: ProjectElement }) {
  const def = registry.get(element.type);
  const v = useValidation();
  const setParams = useEditor.getState().setParams;
  const paramIssues = v.paramIssues.get(element.id) ?? [];
  const topoIssues = v.issues.filter((i) => i.origin === "topologia" && i.elementIds.includes(element.id));

  // Agrupar parámetros visibles respetando el orden de la definición.
  const groups = new Map<string, typeof def.params>();
  for (const p of def.params) {
    if (!isParamActive(p, element.params)) continue;
    const g = p.group ?? "General";
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(p);
  }

  return (
    <div className="properties">
      {topoIssues.length ? (
        <section className="issue-box">
          <h3>{t("inspector.issues")}</h3>
          {topoIssues.map((i) => (
            <p key={i.message} className={i.severity}>
              {i.message}
            </p>
          ))}
        </section>
      ) : null}
      {[...groups.entries()].map(([group, params]) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {params.map((p) => (
            <ParamField
              key={p.key}
              def={p}
              value={element.params[p.key] ?? null}
              providerOptions={p.kind === "enum" && !Array.isArray(p.options) ? v.norm.options(p.options.provider) : undefined}
              issues={paramIssues.filter((i) => i.key === p.key)}
              onCommit={(value) => setParams(element.id, { [p.key]: value })}
            />
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>{t("inspector.notes")}</legend>
        <TextInput id="notes" multiline value={element.notes ?? ""} onCommit={(notes) => useEditor.getState().setElementNotes(element.id, notes)} />
      </fieldset>
    </div>
  );
}
