import {
  ModelError,
  addElement,
  connect,
  createProject,
  disconnect,
  duplicateProject,
  extractClip,
  moveElement,
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

  // Proyecto
  newProject(name: string): void;
  loadProject(p: Project): void;
  duplicateCurrent(): void;
  setName(name: string): void;
  setSymbology(s: "ANSI" | "IEC"): void;
  setSettings(changes: Partial<ProjectSettings>): void;
  setMeta(changes: Partial<Pick<ProjectMeta, "name" | "client" | "location" | "author" | "description">>): void;
  setParams(elementId: string, changes: Record<string, ParamValue>): void;
  setElementNotes(elementId: string, notes: string): void;

  // Edición
  add(type: string, position: { x: number; y: number }): string | null;
  connectPorts(a: PortRef, b: PortRef): void;
  remove(elementIds: string[], connectionIds: string[]): void;
  moveTransient(moves: { id: string; x: number; y: number }[]): void;
  commitDrag(): void;
  rotate(elementIds: string[]): void;
  retag(elementId: string, tag: string): boolean;
  copy(): void;
  paste(): void;
  undo(): void;
  redo(): void;
  select(sel: Selection): void;
  notify(kind: Toast["kind"], text: string): void;
}

let toastSeq = 0;

export const useEditor = create<EditorState>((set, get) => {
  /** Aplica una operación del modelo como una entrada del historial; los errores del modelo se muestran como aviso. */
  const apply = (fn: (p: Project) => Project): boolean => {
    try {
      const next = fn(get().history.present);
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

    newProject: (name) => set({ history: initHistory(createProject({ name })), selection: { elements: [], connections: [] } }),
    loadProject: (p) => set({ history: initHistory(p), selection: { elements: [], connections: [] } }),
    duplicateCurrent: () => {
      set((s) => ({ history: initHistory(duplicateProject(s.history.present)) }));
      get().notify("info", t("msg.duplicated"));
    },
    setName: (name) => {
      if (name.trim()) apply((p) => updateMeta(p, { name: name.trim() }));
    },
    setSymbology: (symbology) => apply((p) => updateSettings(p, { symbology })),
    setSettings: (changes) => apply((p) => updateSettings(p, changes)),
    setMeta: (changes) => apply((p) => updateMeta(p, changes)),
    setParams: (elementId, changes) => apply((p) => updateParams(p, elementId, changes)),
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
    connectPorts: (a, b) => {
      apply((p) => connect(p, registry, a, b).project);
    },
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
    commitDrag: () => {
      const { dragBase } = get();
      if (dragBase) set((s) => ({ history: commitFrom(s.history, dragBase), dragBase: null }));
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
    notify: (kind, text) => set({ toast: { id: ++toastSeq, kind, text } }),
  };
});

export const useProject = () => useEditor((s) => s.history.present);
