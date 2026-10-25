/**
 * @rea/reports — reportes a partir del modelo y del resultado del motor:
 * - unifilar en SVG vectorial (y de ahí PNG/PDF);
 * - memoria de cálculo en PDF (definición de pdfmake);
 * - cédula, cuadros de carga y memoria en Excel (ExcelJS).
 * No depende de la interfaz; la impresión del PDF la hace quien llama (navegador o Node).
 */
export * from "./data";
export * from "./strings";
export { diagramSvg, type DiagramSvgOptions } from "./diagram-svg";
export { diagramPdfDocDefinition, memoriaDocDefinition, svgAspect } from "./memoria-pdf";
export { buildWorkbook } from "./excel";
