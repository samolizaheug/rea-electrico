import { isParamActive, voltageText, type ProjectElement } from "@rea/core";
import { lib, t } from "../i18n";
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

  // Tensión de sistemas con neutro: línea a línea / fase a neutro (220/127 V, 240/120 V).
  const voltageHint = (key: string): string | undefined => {
    const port = def.ports.find((x) => x.voltage?.param === key);
    const value = element.params[key];
    const system = port?.voltage?.system ? element.params[port.voltage.system] : undefined;
    return typeof value === "number" && value > 0 && (system === "3F4H" || system === "1F3H") ? voltageText(value, system) : undefined;
  };

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
          <legend>{lib(group)}</legend>
          {params.map((p) => (
            <ParamField
              key={p.key}
              def={p}
              value={element.params[p.key] ?? null}
              providerOptions={p.kind === "enum" && !Array.isArray(p.options) ? v.norm.options(p.options.provider, element.params) : undefined}
              issues={paramIssues.filter((i) => i.key === p.key)}
              hint={voltageHint(p.key)}
              onCommit={(value) =>
                // Las medidas comerciales dependen del tipo de canalización: al cambiarlo se borra la medida.
                setParams(element.id, p.key === "installationMethod" && value !== element.params.installationMethod ? { installationMethod: value, racewaySize: null } : { [p.key]: value })
              }
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
