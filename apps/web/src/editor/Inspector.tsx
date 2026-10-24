import { useEffect, useState } from "react";
import { t } from "../i18n";
import { registry } from "../state/registry";
import { useEditor, useProject } from "../state/store";

/** Panel lateral: datos del elemento seleccionado. En la E3 solo etiqueta y giro; la E4 agrega todos los parámetros. */
export function Inspector() {
  const project = useProject();
  const selection = useEditor((s) => s.selection);
  const ed = useEditor.getState();
  const el = selection.elements.length === 1 ? project.elements.find((e) => e.id === selection.elements[0]) : undefined;
  const [tag, setTag] = useState(el?.tag ?? "");
  useEffect(() => setTag(el?.tag ?? ""), [el?.id, el?.tag]);

  if (selection.elements.length > 1) {
    return (
      <aside className="inspector">
        <h2>{t("inspector.title")}</h2>
        <p>{t("inspector.multi", { n: selection.elements.length })}</p>
        <div className="actions">
          <button onClick={() => ed.rotate(selection.elements)}>{t("inspector.rotate")}</button>
          <button className="danger" onClick={() => ed.remove(selection.elements, selection.connections)}>
            {t("inspector.delete")}
          </button>
        </div>
      </aside>
    );
  }
  if (!el) {
    return (
      <aside className="inspector">
        <h2>{t("inspector.title")}</h2>
        <p className="muted">{t("inspector.empty")}</p>
        <p className="muted small">{t("help.shortcuts")}</p>
      </aside>
    );
  }

  const def = registry.get(el.type);
  const commitTag = () => {
    if (tag.trim() === el.tag) return;
    if (!ed.retag(el.id, tag)) setTag(el.tag);
  };

  return (
    <aside className="inspector">
      <h2>{t("inspector.title")}</h2>
      <label className="field">
        <span>{t("inspector.tag")}</span>
        <input value={tag} onChange={(e) => setTag(e.target.value)} onBlur={commitTag} onKeyDown={(e) => e.key === "Enter" && commitTag()} />
      </label>
      <dl className="facts">
        <dt>{t("inspector.type")}</dt>
        <dd>{def.name}</dd>
      </dl>
      <div className="actions">
        <button onClick={() => ed.rotate([el.id])}>{t("inspector.rotate")}</button>
        <button className="danger" onClick={() => ed.remove([el.id], [])}>
          {t("inspector.delete")}
        </button>
      </div>
      <p className="muted small">{t("inspector.paramsSoon")}</p>
    </aside>
  );
}
