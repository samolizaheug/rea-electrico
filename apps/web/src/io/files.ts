import { parseProject, serializeProject, type Project, type ProjectIssue } from "@rea/core";
import { registry } from "../state/registry";

const AUTOSAVE_KEY = "rea-electrico:autosave";

export function fileNameFor(p: Project): string {
  const slug = p.meta.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${slug || "proyecto"}.rea.json`;
}

/** Descarga el proyecto como archivo JSON. */
export function downloadProject(p: Project): string {
  const name = fileNameFor(p);
  const url = URL.createObjectURL(new Blob([serializeProject(p)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

/** Abre un archivo elegido por el usuario. Lanza ProjectFormatError si no es válido. */
export async function readProjectFile(file: File): Promise<{ project: Project; issues: ProjectIssue[] }> {
  return parseProject(await file.text(), registry);
}

/** Autoguardado en el navegador: es una conveniencia, no sustituye guardar el archivo. */
export function saveAutosave(p: Project): boolean {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeProject(p));
    return true;
  } catch {
    return false;
  }
}

export function loadAutosave(): Project | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    return text ? parseProject(text, registry).project : null;
  } catch {
    return null;
  }
}
