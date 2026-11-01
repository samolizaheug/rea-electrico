import { ProjectFormatError } from "@rea/core";
import { EJEMPLOS } from "@rea/ejemplos";
import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { downloadProject, readProjectFile } from "../io/files";
import { exportReport, NEEDS_RESULTS, type ExportKind } from "../io/reports";
import { useEditor, useProject } from "../state/store";
import { useValidation } from "../state/validation";

export function Toolbar() {
  const project = useProject();
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const ed = useEditor.getState();
  const flow = useReactFlow();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project.meta.name);
  const [busy, setBusy] = useState(false);
  const hasResults = !!useValidation().results;
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
            const n = prompt(t("prompt.newName"), t("prompt.defaultName"));
            if (n) ed.newProject(n);
          }}
        >
          {t("toolbar.new")}
        </button>
        <button onClick={() => fileInput.current?.click()}>{t("toolbar.open")}</button>
        <ExamplesMenu
          onLoaded={() => {
            // Dos ajustes: el segundo, ya medidos los símbolos del proyecto nuevo.
            setTimeout(() => flow.fitView({ padding: 0.1 }), 60);
            setTimeout(() => flow.fitView({ padding: 0.1 }), 400);
          }}
        />
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
      <div className="group">
        <select
          aria-label={t("export.title")}
          value=""
          disabled={busy}
          onChange={(e) => {
            const kind = e.target.value as ExportKind;
            if (!kind) return;
            setBusy(true);
            exportReport(kind)
              .then((file) => ed.notify("info", t("msg.saved", { file })))
              .catch((err: Error) => ed.notify("error", t("export.failed", { message: err.message })))
              .finally(() => setBusy(false));
          }}
        >
          <option value="">{busy ? t("export.working") : t("export.title")}</option>
          {(["svg", "png", "pdf-diagram", "pdf-memoria", "xlsx"] as const).map((k) => (
            <option key={k} value={k} disabled={NEEDS_RESULTS[k] && !hasResults}>
              {t(`export.${k}`)}
            </option>
          ))}
        </select>
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

/** Menú de proyectos de ejemplo: abre una copia nueva del ejemplo (reemplaza el proyecto abierto). */
function ExamplesMenu({ onLoaded }: { onLoaded(): void }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="examples-menu" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          // La barra se desplaza horizontalmente y recortaría la lista: se coloca fija bajo el botón.
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - 436)), top: r.bottom + 4 });
          setOpen((o) => !o);
        }}
      >
        {t("toolbar.examples")} ▾
      </button>
      {open ? (
        <div className="examples-list" role="menu" style={{ left: at.left, top: at.top }}>
          <p className="hint">{t("examples.hint")}</p>
          {EJEMPLOS.map((e) => (
            <button
              key={e.id}
              role="menuitem"
              className="example-item"
              onClick={() => {
                if (!confirm(t("confirm.example", { name: e.title }))) return;
                const ed = useEditor.getState();
                ed.loadProject(e.build());
                ed.notify("info", t("msg.opened", { name: e.title }));
                setOpen(false);
                onLoaded();
              }}
            >
              <strong>{e.title}</strong>
              <span>{e.summary}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
