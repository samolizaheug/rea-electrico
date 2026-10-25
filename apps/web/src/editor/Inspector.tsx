import { useEffect, useState } from "react";
import { lib, t } from "../i18n";
import { registry } from "../state/registry";
import { useEditor, useProject } from "../state/store";
import { ResultsSection } from "../results/ResultsSection";
import { ElementProperties } from "./ElementProperties";
import { ProjectPanel } from "./ProjectPanel";

/**
 * Panel lateral:
 * - sin selección: datos del proyecto y criterios de diseño;
 * - un elemento: etiqueta, acciones y propiedades;
 * - una conexión o varios elementos: resumen y acciones.
 */
export function Inspector() {
  const project = useProject();
  const selection = useEditor((s) => s.selection);
  const ed = useEditor.getState();
  const el = selection.elements.length === 1 ? project.elements.find((e) => e.id === selection.elements[0]) : undefined;
  const [tag, setTag] = useState(el?.tag ?? "");
  const [panel, setPanel] = useState<"propiedades" | "resultados">("propiedades");
  useEffect(() => setTag(el?.tag ?? ""), [el?.id, el?.tag]);

  if (selection.elements.length > 1) {
    return (
      <aside className="inspector">
        <h2>{t("inspector.title")}</h2>
        <p>{t("inspector.multi", { n: selection.elements.length })}</p>
        <div className="actions">
          <button onClick={() => ed.rotate(selection.elements)}>{t("inspector.rotate")}</button>
          <button title={t("inspector.disconnectHelp")} onClick={() => ed.disconnectElements(selection.elements)}>{t("inspector.disconnect")}</button>
          <button className="danger" onClick={() => ed.remove(selection.elements, selection.connections)}>
            {t("inspector.delete")}
          </button>
        </div>
      </aside>
    );
  }

  if (!el && selection.connections.length === 1) {
    const c = project.connections.find((x) => x.id === selection.connections[0]);
    const tagOf = (id: string) => project.elements.find((e) => e.id === id)?.tag ?? "?";
    return (
      <aside className="inspector">
        <h2>{t("inspector.connection")}</h2>
        {c ? <p>{t("inspector.connectionBetween", { a: `${tagOf(c.a.elementId)}.${c.a.portId}`, b: `${tagOf(c.b.elementId)}.${c.b.portId}` })}</p> : null}
        <div className="actions">
          <button className="danger" onClick={() => ed.remove([], selection.connections)}>
            {t("inspector.delete")}
          </button>
        </div>
      </aside>
    );
  }

  if (!el) {
    return (
      <aside className="inspector">
        <h2>{t("project.title")}</h2>
        <ProjectPanel />
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
      <h2>{lib(def.name)}</h2>
      <div className="field">
        <label htmlFor="el-tag">{t("inspector.tag")}</label>
        <input id="el-tag" value={tag} onChange={(e) => setTag(e.target.value)} onBlur={commitTag} onKeyDown={(e) => e.key === "Enter" && commitTag()} />
      </div>
      <div className="actions">
        <button onClick={() => ed.rotate([el.id])}>{t("inspector.rotate")}</button>
        <button
          title={t("inspector.disconnectHelp")}
          disabled={!project.connections.some((c) => c.a.elementId === el.id || c.b.elementId === el.id)}
          onClick={() => ed.disconnectElements([el.id])}
        >
          {t("inspector.disconnect")}
        </button>
        <button className="danger" onClick={() => ed.remove([el.id], [])}>
          {t("inspector.delete")}
        </button>
      </div>
      <nav className="tabs small-tabs" role="tablist">
        {(["propiedades", "resultados"] as const).map((id) => (
          <button key={id} role="tab" aria-selected={panel === id} className={panel === id ? "active" : ""} onClick={() => setPanel(id)}>
            {t(`inspector.tab.${id}`)}
          </button>
        ))}
      </nav>
      {panel === "propiedades" ? <ElementProperties element={el} /> : <ResultsSection elementId={el.id} />}
    </aside>
  );
}
