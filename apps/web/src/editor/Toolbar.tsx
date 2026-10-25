import { ProjectFormatError } from "@rea/core";
import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { downloadProject, readProjectFile } from "../io/files";
import { useEditor, useProject } from "../state/store";

export function Toolbar() {
  const project = useProject();
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const ed = useEditor.getState();
  const flow = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project.meta.name);
  useEffect(() => setName(project.meta.name), [project.meta.name]);

  const onOpen = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { project: p, issues } = await readProjectFile(file);
      ed.loadProject(p);
      if (issues.length) {
        console.warn("Advertencias al abrir el proyecto:", issues);
        ed.notify("info", t("msg.openWarnings", { n: issues.length }));
      } else ed.notify("info", t("msg.opened", { name: p.meta.name }));
      setTimeout(() => flow.fitView({ padding: 0.2 }), 50);
    } catch (e) {
      const detail = e instanceof ProjectFormatError && e.issues.length ? ` (${e.issues[0]!.path}: ${e.issues[0]!.message})` : "";
      ed.notify("error", `${(e as Error).message}${detail}`);
    }
  };

  return (
    <header className="toolbar">
      <span className="brand">{t("app.title")}</span>
      <input
        className="project-name"
        aria-label={t("toolbar.projectName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => ed.setName(name)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <div className="group">
        <button
          onClick={() => {
            if (!confirm(t("confirm.new"))) return;
            const n = prompt(t("prompt.newName"), "Proyecto sin título");
            if (n) ed.newProject(n);
          }}
        >
          {t("toolbar.new")}
        </button>
        <button onClick={() => fileInput.current?.click()}>{t("toolbar.open")}</button>
        <button onClick={() => ed.notify("info", t("msg.saved", { file: downloadProject(useEditor.getState().history.present) }))}>
          {t("toolbar.save")}
        </button>
        <button onClick={() => ed.duplicateCurrent()}>{t("toolbar.duplicate")}</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => onOpen(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
      </div>
      <div className="group">
        <button onClick={() => ed.undo()} disabled={!canUndo} title={`${t("toolbar.undo")} (Ctrl+Z)`}>
          {t("toolbar.undo")}
        </button>
        <button onClick={() => ed.redo()} disabled={!canRedo} title={`${t("toolbar.redo")} (Ctrl+Y)`}>
          {t("toolbar.redo")}
        </button>
        <button onClick={() => flow.fitView({ padding: 0.2 })}>{t("toolbar.fit")}</button>
      </div>
      <label className="group symbology">
        {t("toolbar.symbology")}
        <select value={project.settings.symbology} onChange={(e) => ed.setSymbology(e.target.value as "ANSI" | "IEC")}>
          <option value="ANSI">ANSI / IEEE</option>
          <option value="IEC">IEC</option>
        </select>
      </label>
    </header>
  );
}
