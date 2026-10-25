import { Canvas } from "./editor/Canvas";
import { t } from "./i18n";
import { SchedulesView } from "./results/SchedulesView";
import { TableView } from "./results/TableView";
import { useEditor } from "./state/store";

/** Zona central con pestañas: diagrama, tabla de elementos y cuadros de carga. */
export function Workspace() {
  const view = useEditor((s) => s.view);
  const showResults = useEditor((s) => s.showResults);
  const ed = useEditor.getState();
  const tabs = [
    ["diagrama", t("view.diagram")],
    ["tabla", t("view.table")],
    ["cuadros", t("view.schedules")],
  ] as const;
  return (
    <main className="workspace">
      <nav className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} className={view === id ? "active" : ""} onClick={() => ed.setView(id)}>
            {label}
          </button>
        ))}
        {view === "diagrama" ? (
          <label className="tab-option">
            <input type="checkbox" checked={showResults} onChange={(e) => ed.setShowResults(e.target.checked)} /> {t("view.showResults")}
          </label>
        ) : null}
      </nav>
      {/* El lienzo se mantiene montado para conservar el zoom y la posición al cambiar de pestaña. */}
      <div className="view-body" hidden={view !== "diagrama"}>
        <Canvas />
      </div>
      {view === "tabla" ? <TableView /> : null}
      {view === "cuadros" ? <SchedulesView /> : null}
    </main>
  );
}
