import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

/**
 * Impresión de PDF en Node (scripts y pruebas). El navegador usa la versión empaquetada de
 * pdfmake con sus fuentes virtuales; aquí se toman las mismas fuentes Roboto del paquete.
 */
const require = createRequire(import.meta.url);

export async function renderPdf(def: TDocumentDefinitions): Promise<Buffer> {
  const pdfmake = require("pdfmake");
  const dir = join(dirname(require.resolve("pdfmake/package.json")), "fonts", "Roboto");
  pdfmake.setFonts({
    Roboto: {
      normal: join(dir, "Roboto-Regular.ttf"),
      bold: join(dir, "Roboto-Medium.ttf"),
      italics: join(dir, "Roboto-Italic.ttf"),
      bolditalics: join(dir, "Roboto-MediumItalic.ttf"),
    },
  });
  // Solo se permite leer las fuentes; no hay descargas.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p: string) => p.startsWith(dir));
  return pdfmake.createPdf(def).getBuffer();
}
