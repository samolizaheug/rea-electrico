import type { ReportInput } from "@rea/reports";
import { registry } from "../state/registry";
import { useEditor } from "../state/store";
import { validationFor } from "../state/validation";
import { baseNameFor, downloadBlob } from "./files";

/**
 * Exportación de reportes desde el editor. Las bibliotecas de PDF y Excel se cargan solo al
 * exportar (no forman parte de la carga inicial del editor).
 */
export type ExportKind = "svg" | "png" | "pdf-diagram" | "pdf-memoria" | "xlsx";

/** Los reportes con resultados requieren que el cálculo se haya podido ejecutar. */
export const NEEDS_RESULTS: Record<ExportKind, boolean> = { svg: false, png: false, "pdf-diagram": false, "pdf-memoria": true, xlsx: true };

async function pdfBlob(def: import("pdfmake/interfaces").TDocumentDefinitions): Promise<Blob> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  pdfMake.addVirtualFileSystem(vfs);
  return pdfMake.createPdf(def).getBlob();
}

/** Rasteriza el SVG en el navegador (escala 2 para impresión legible). */
function svgToPng(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(img.naturalWidth * scale);
      canvas.height = Math.ceil(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar el PNG."))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo dibujar el unifilar."));
    };
    img.src = url;
  });
}

/** Genera y descarga el reporte; devuelve el nombre del archivo. */
export async function exportReport(kind: ExportKind): Promise<string> {
  const project = useEditor.getState().history.present;
  const v = validationFor(project);
  const r = await import("@rea/reports");
  r.setReportLanguage(project.settings.language);
  const base = baseNameFor(project);
  const issues = v.issues.map((i) => ({ severity: i.severity, message: i.message, elementIds: i.elementIds }));
  const showResults = useEditor.getState().showResults && !!v.results;

  if (NEEDS_RESULTS[kind] && !v.results) throw new Error("No hay resultados: corrige los errores de datos o de topología para calcular.");
  const input: ReportInput | null = v.results
    ? { project, registry, norm: v.norm, sizing: v.results.sizing, schedules: v.results.schedules, issues }
    : null;
  const draft = input ? r.isDraft(input) : true;
  const svg = () => r.diagramSvg(project, registry, { results: showResults ? v.results!.sizing : undefined, issues: r.issueSeverityByElement(issues), norm: v.norm, draft });

  switch (kind) {
    case "svg":
      return downloadBlob(new Blob([svg()], { type: "image/svg+xml" }), `${base}-unifilar.svg`);
    case "png":
      return downloadBlob(await svgToPng(svg()), `${base}-unifilar.png`);
    case "pdf-diagram":
      return downloadBlob(await pdfBlob(r.diagramPdfDocDefinition(svg(), `Unifilar — ${project.meta.name}`)), `${base}-unifilar.pdf`);
    case "pdf-memoria":
      return downloadBlob(await pdfBlob(r.memoriaDocDefinition(input!)), `${base}-memoria.pdf`);
    case "xlsx": {
      const wb = await r.buildWorkbook(input!);
      const buf = await wb.xlsx.writeBuffer();
      return downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}-memoria.xlsx`);
    }
  }
}
