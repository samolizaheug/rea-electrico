/**
 * Historial deshacer/rehacer. Como el modelo es inmutable, cada estado es una instantánea
 * completa del proyecto (las partes no modificadas se comparten en memoria).
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_LIMIT = 200;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Registra un nuevo estado. Si es idéntico al actual (misma referencia), no hace nada. */
export function push<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: next, future: [] };
}

/** Reemplaza el estado actual sin crear entrada (cambios transitorios como arrastrar). */
export function replace<T>(h: History<T>, next: T): History<T> {
  return { ...h, present: next };
}

/** Confirma como una sola entrada el cambio desde `base` hasta el estado actual. */
export function commitFrom<T>(h: History<T>, base: T): History<T> {
  if (base === h.present) return h;
  const past = [...h.past, base];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: h.present, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
}
