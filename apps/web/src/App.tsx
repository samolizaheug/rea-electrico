import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { Canvas } from "./editor/Canvas";
import { Inspector } from "./editor/Inspector";
import { Palette } from "./editor/Palette";
import { Toolbar } from "./editor/Toolbar";
import { t } from "./i18n";
import { loadAutosave, saveAutosave } from "./io/files";
import { useEditor, useProject } from "./state/store";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** Atajos de teclado globales del editor. Supr se maneja dentro de React Flow. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const ed = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) ed.undo();
      else if (mod && (k === "y" || (k === "z" && e.shiftKey))) ed.redo();
      else if (mod && k === "c") ed.copy();
      else if (mod && k === "v") ed.paste();
      else if (mod && k === "d") {
        ed.copy();
        ed.paste();
      } else if (!mod && k === "r") ed.rotate(ed.selection.elements);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Restaura el autoguardado al iniciar y guarda (con retardo) en cada cambio. */
function useAutosave() {
  useEffect(() => {
    const restored = loadAutosave();
    if (restored) useEditor.getState().loadProject(restored);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.history.present === prev.history.present) return;
      clearTimeout(timer);
      timer = setTimeout(() => saveAutosave(useEditor.getState().history.present), 500);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
}

function ToastView() {
  const toast = useEditor((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useEditor.setState({ toast: null }), toast.kind === "error" ? 6000 : 3000);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      {toast.text}
    </div>
  );
}

function StatusBar() {
  const p = useProject();
  return (
    <footer className="statusbar">
      <span>{t("status.counts", { elements: p.elements.length, connections: p.connections.length })}</span>
      <span>
        {p.settings.norm.id.toUpperCase()} {p.settings.norm.edition} · {p.settings.symbology}
      </span>
      <span className="muted">{t("status.saved")}</span>
    </footer>
  );
}

export function App() {
  useShortcuts();
  useAutosave();
  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <Palette />
        <Canvas />
        <Inspector />
        <StatusBar />
        <ToastView />
      </div>
    </ReactFlowProvider>
  );
}
