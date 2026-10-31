import {
  setConnectionSection,
  ModelError,
  addElement,
  connect,
  createProject,
  disconnect,
  duplicateProject,
  extractClip,
  moveElement,
  resizeBus,
  pasteClip,
  removeElements,
  rotateElements,
  setNotes,
  setTag,
  updateMeta,
  updateParams,
  updateSettings,
  type Clip,
  type ParamValue,
  type PortRef,
  type Project,
  type ProjectMeta,
  type ProjectSettings,
} from "@rea/core";
import { getNormModule } from "@rea/norms";
import { mccDefaultWidth, syncMccSections } from "@rea/symbols";
import { alignElements, nudgeElements, spreadElements, type AlignMode } from "../editor/arrange";
import { distributeBus } from "../editor/distribute";
import { resultBadge } from "../results/format";
import { validationFor } from "./validation";
import { create } from "zustand";
import { t } from "../i18n";
import { commitFrom, initHistory, push, redo, replace, undo, type History } from "./history";
import { registry } from "./registry";

export interface Selection {
  elements: string[];
  connections: string[];
}

export interface Toast {
  id: number;
  kind: "info" | "error";
  text: string;
}

interface EditorState {
  history: History<Project>;
  selection: Selection;
  clipboard: Clip | null;
  /** Proyecto al iniciar un arrastre; al soltar se confirma como una sola entrada del historial. */
  dragBase: Project | null;
  toast: Toast | null;
  /** Panel de observaciones de validación abierto. */
  issuesOpen: boolean;
  setIssuesOpen(open: boolean): void;
  /** Vista central: diagrama, tabla de elementos o cuadros de carga. */
  view: "diagrama" | "tabla" | "cuadros";
  setView(view: EditorState["view"]): void;
  /** Mostrar resultados del cálculo sobre el diagrama. */
  showResults: boolean;
  setShowResults(v: boolean): void;
  /** Herramienta del lienzo: «select» = arrastrar en vacío dibuja un cuadro; «pan» = arrastrar mueve la vista. */
  tool: "select" | "pan";
  setTool(tool: EditorState["tool"]): void;

  // Proyecto
  newProject(name: string): void;
  loadProject(p: Project): void;
  duplicateCurrent(): void;
  setName(name: string): void;
  setSymbology(s: "ANSI" | "IEC"): void;
  setSettings(changes: Partial<ProjectSettings>): void;
  /** Cambia de norma con el proyecto ya adaptado (ver norm-switch.ts); un solo paso de deshacer. */
  replaceProject(next: Project): void;
  setMeta(changes: Partial<Pick<ProjectMeta, "name" | "client" | "location" | "author" | "description">>): void;
  setParams(elementId: string, changes: Record<string, ParamValue>): void;
  /** Cambia las secciones de un CCM (y otros datos) y, si hace falta, lo alarga para que quepan. */
  setMccSections(elementId: string, sections: number, changes: Record<string, ParamValue>): void;
  setElementNotes(elementId: string, notes: string): void;

  // Edición
  add(type: string, position: { x: number; y: number }): string | null;
  /** Conecta dos puertos; busSection = sección del CCM si se conectó al punto de una sección. */
  connectPorts(a: PortRef, b: PortRef, busSection?: number): void;
  /** Cambia la sección del CCM de una conexión existente. */
  setConnectionSection(connectionId: string, section: number | null): void;
  /** Separa los circuitos de una barra, tablero o CCM para que no se encimen (un paso de deshacer). */
  distributeBus(busId: string): void;
  remove(elementIds: string[], connectionIds: string[]): void;
  moveTransient(moves: { id: string; x: number; y: number }[]): void;
  /** Cambia la longitud de una barra mientras se arrastra su extremo (se confirma con commitDrag). */
  resizeBusTransient(id: string, length: number, x: number, y: number): void;
  commitDrag(): void;
  rotate(elementIds: string[]): void;
  /** Quita todas las conexiones de los elementos sin eliminarlos (para moverlos a otro circuito). */
  disconnectElements(elementIds: string[]): void;
  retag(elementId: string, tag: string): boolean;
  copy(): void;
  paste(): void;
  undo(): void;
  redo(): void;
  select(sel: Selection): void;
  /** Selecciona todos los elementos y cables. */
  selectAll(): void;
  /** Mueve la selección (un paso de deshacer). */
  nudgeSelection(dx: number, dy: number): void;
  alignSelection(mode: AlignMode): void;
  spreadSelection(axis: "x" | "y"): void;
  notify(kind: Toast["kind"], text: string): void;
}

let toastSeq = 0;

const TOOL_KEY = "rea.tool";
function readTool(): "select" | "pan" {
  try {
    return localStorage.getItem(TOOL_KEY) === "pan" ? "pan" : "select";
  } catch {
    return "select";
  }
}

export const useEditor = create<EditorState>((set, get) => {
  /** Aplica una operación del modelo como una entrada del historial; los errores del modelo se muestran como aviso. */
  const apply = (fn: (p: Project) => Project): boolean => {
    try {
      // La sección del CCM de cada circuito sale de dónde está dibujado (bajo qué sección).
      const next = syncMccSections(fn(get().history.present), registry);
      set((s) => ({ history: push(s.history, next) }));
      return true;
    } catch (e) {
      if (e instanceof ModelError) {
        get().notify("error", e.message);
        return false;
      }
      throw e;
    }
  };

  return {
    history: initHistory(createProject({ name: "Proyecto sin título" })),
    selection: { elements: [], connections: [] },
    clipboard: null,
    dragBase: null,
    toast: null,
    issuesOpen: false,
    setIssuesOpen: (issuesOpen) => set({ issuesOpen }),
    view: "diagrama",
    setView: (view) => set({ view }),
    showResults: true,
    setShowResults: (showResults) => set({ showResults }),
    tool: readTool(),
    setTool: (tool) => {
      try {
        localStorage.setItem(TOOL_KEY, tool);
      } catch {
        // Sin almacenamiento: el modo solo dura esta sesión.
      }
      set({ tool });
    },

    newProject: (name) => set({ history: initHistory(createProject({ name })), selection: { elements: [], connections: [] } }),
    loadProject: (p) => set({ history: initHistory(syncMccSections(p, registry)), selection: { elements: [], connections: [] } }),
    duplicateCurrent: () => {
      set((s) => ({ history: initHistory(duplicateProject(s.history.present)) }));
      get().notify("info", t("msg.duplicated"));
    },
    setName: (name) => {
      if (name.trim()) apply((p) => updateMeta(p, { name: name.trim() }));
    },
    setSymbology: (symbology) => apply((p) => updateSettings(p, { symbology })),
    setSettings: (changes) => apply((p) => updateSettings(p, changes)),
    replaceProject: (next) => apply(() => next),
    setMeta: (changes) => apply((p) => updateMeta(p, changes)),
    setParams: (elementId, changes) => apply((p) => updateParams(p, elementId, changes)),
    setMccSections: (elementId, sections, changes) =>
      apply((p) => {
        const q = updateParams(p, elementId, changes);
        const n = q.diagram.nodes[elementId];
        const need = mccDefaultWidth(sections);
        return n && n.length !== undefined && n.length < need ? resizeBus(q, elementId, need, n.x, n.y) : q;
      }),
    setElementNotes: (elementId, notes) => apply((p) => setNotes(p, elementId, notes)),

    add: (type, position) => {
      let id: string | null = null;
      apply((p) => {
        // La norma activa propone valores por defecto (p. ej. aislamiento y canalización de los cables).
        const params = getNormModule(p.settings.norm.id, p.settings.norm.edition).paramDefaults(type);
        const r = addElement(p, registry, type, { position, params });
        id = r.elementId;
        return r.project;
      });
      if (id) set({ selection: { elements: [id], connections: [] } });
      return id;
    },
    connectPorts: (a, b, busSection) => {
      apply((p) => {
        const r = connect(p, registry, a, b);
        return busSection !== undefined && r.connectionId ? setConnectionSection(r.project, r.connectionId, busSection) : r.project;
      });
    },
    setConnectionSection: (connectionId, section) => apply((p) => setConnectionSection(p, connectionId, section)),
    distributeBus: (busId) =>
      apply((p) => {
        // Los textos que ocupan espacio son la etiqueta y los renglones de resultados (si hay cálculo).
        const results = validationFor(p).results;
        const linesOf = (id: string) => {
          const el = p.elements.find((x) => x.id === id);
          return el && results ? resultBadge(id, el.type, results) : [];
        };
        return distributeBus(p, registry, busId, linesOf);
      }),
    remove: (elementIds, connectionIds) => {
      if (!elementIds.length && !connectionIds.length) return;
      apply((p) => {
        let q = connectionIds.reduce((acc, id) => disconnect(acc, id), p);
        if (elementIds.length) q = removeElements(q, elementIds);
        return q;
      });
      set({ selection: { elements: [], connections: [] } });
    },
    moveTransient: (moves) => {
      const s = get();
      const base = s.dragBase ?? s.history.present;
      const next = moves.reduce((acc, m) => moveElement(acc, m.id, m.x, m.y), s.history.present);
      set({ dragBase: base, history: replace(s.history, next) });
    },
    resizeBusTransient: (id, length, x, y) => {
      const s = get();
      const base = s.dragBase ?? s.history.present;
      set({ dragBase: base, history: replace(s.history, resizeBus(s.history.present, id, length, x, y)) });
    },
    commitDrag: () => {
      const { dragBase } = get();
      if (!dragBase) return;
      const synced = syncMccSections(get().history.present, registry);
      set((s) => ({ history: commitFrom(synced === s.history.present ? s.history : replace(s.history, synced), dragBase), dragBase: null }));
    },
    disconnectElements: (elementIds) => {
      const ids = new Set(elementIds);
      const conns = get().history.present.connections.filter((c) => ids.has(c.a.elementId) || ids.has(c.b.elementId));
      if (conns.length) apply((p) => conns.reduce((acc, c) => disconnect(acc, c.id), p));
    },
    rotate: (elementIds) => {
      if (elementIds.length) apply((p) => rotateElements(p, elementIds, 90));
    },
    retag: (elementId, tag) => apply((p) => setTag(p, elementId, tag)),
    copy: () => {
      const { selection, history } = get();
      if (selection.elements.length) set({ clipboard: extractClip(history.present, selection.elements) });
    },
    paste: () => {
      const { clipboard } = get();
      if (!clipboard) return;
      let ids: string[] = [];
      const ok = apply((p) => {
        const r = pasteClip(p, registry, clipboard, { x: 40, y: 40 });
        ids = Object.values(r.idMap);
        return r.project;
      });
      if (ok) {
        // El siguiente pegado se desplaza otra vez respecto a la última copia.
        set({ selection: { elements: ids, connections: [] }, clipboard: extractClip(get().history.present, ids) });
        get().notify("info", t("msg.pasted", { n: ids.length }));
      }
    },
    undo: () => set((s) => ({ history: undo(s.history), selection: { elements: [], connections: [] } })),
    redo: () => set((s) => ({ history: redo(s.history), selection: { elements: [], connections: [] } })),
    select: (selection) => set({ selection }),
    selectAll: () => {
      const p = get().history.present;
      set({ selection: { elements: p.elements.map((e) => e.id), connections: p.connections.map((c) => c.id) } });
    },
    nudgeSelection: (dx, dy) => {
      const ids = get().selection.elements;
      if (ids.length) apply((p) => nudgeElements(p, ids, dx, dy));
    },
    alignSelection: (mode) => {
      const ids = get().selection.elements;
      if (ids.length > 1) apply((p) => alignElements(p, registry, ids, mode));
    },
    spreadSelection: (axis) => {
      const ids = get().selection.elements;
      if (ids.length > 2) apply((p) => spreadElements(p, registry, ids, axis));
    },
    notify: (kind, text) => set({ toast: { id: ++toastSeq, kind, text } }),
  };
});

export const useProject = () => useEditor((s) => s.history.present);
