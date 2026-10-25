import { z } from "zod";

/**
 * Formato de archivo de proyecto (versión de esquema 1).
 *
 * Separa tres cosas:
 * - `elements` + `connections`: el MODELO ELÉCTRICO (lo que calcula el motor).
 * - `diagram`: la REPRESENTACIÓN (posiciones, rotación, trazos). Cambiar la simbología
 *   o mover un símbolo no modifica el modelo eléctrico.
 * - `settings`: norma, simbología, unidades y condiciones por defecto.
 *
 * Documentación del formato: docs/formato-proyecto.md
 */

export const PROJECT_FORMAT = "rea-electrico/proyecto";
export const CURRENT_SCHEMA_VERSION = 1;

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Identificador con caracteres no permitidos");

export const paramValueSchema = z.union([z.number().finite(), z.string(), z.boolean(), z.null()]);

export const normSelectionSchema = z.object({
  /** Módulo normativo: "nom-001-sede" o "iec-60364" (el registro admite agregar otros). */
  id: z.string().min(1),
  /** Edición: "2012" para la NOM; "2020" | "2023" | "2026" para el NEC. */
  edition: z.string().min(1),
});

export const projectSettingsSchema = z.object({
  norm: normSelectionSchema,
  symbology: z.enum(["ANSI", "IEC"]),
  units: z.object({
    conductorSize: z.enum(["mm2", "AWG"]),
    length: z.enum(["m", "ft"]),
  }),
  language: z.enum(["es", "en"]),
  frequencyHz: z.union([z.literal(50), z.literal(60)]),
  ambient: z.object({
    /** Temperatura ambiente por defecto para conductores al aire o en canalización, °C. */
    airC: z.number().min(-40).max(90),
    /** Temperatura del terreno para instalaciones enterradas, °C. */
    groundC: z.number().min(-20).max(60),
  }),
  /** Límites de caída de tensión en %. Configurables; en la NOM son recomendaciones (notas de 210-19 y 215-2). */
  voltageDrop: z.object({
    branchPct: z.number().positive().max(100),
    feederPct: z.number().positive().max(100),
    totalPct: z.number().positive().max(100),
  }),
  /**
   * Desbalance máximo entre fases en tableros trifásicos, %. La NOM no fija un valor; arriba del
   * límite se emite una advertencia. Opcional en archivos anteriores (se toma 5 %).
   */
  phaseUnbalance: z.object({ maxPct: z.number().positive().max(100) }).default({ maxPct: 5 }),
});

export const projectMetaSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  client: z.string().max(200),
  location: z.string().max(300),
  author: z.string().max(200),
  description: z.string().max(5000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const elementSchema = z.object({
  id,
  /** Tipo registrado (p. ej. "transformer"). */
  type: z.string().min(1),
  /** Etiqueta visible (TR-1, TAB-A, M-01...). */
  tag: z.string().min(1).max(40),
  /** true si el usuario editó la etiqueta; el renumerado automático la respeta. */
  tagLocked: z.boolean(),
  params: z.record(paramValueSchema),
  notes: z.string().max(2000).optional(),
});

export const portRefSchema = z.object({
  elementId: id,
  portId: z.string().min(1),
});

/** Conexión eléctrica de impedancia nula entre dos puertos. */
export const connectionSchema = z.object({
  id,
  a: portRefSchema,
  b: portRefSchema,
});

export const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

export const diagramSchema = z.object({
  nodes: z.record(
    z.object({
      x: z.number().finite(),
      y: z.number().finite(),
      rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
      /** Solo barras, tableros y CCM: longitud dibujada de la barra (px, sin girar). Vacío = la del símbolo. */
      length: z.number().positive().optional(),
    }),
  ),
  wires: z.record(z.object({ waypoints: z.array(pointSchema) })),
});

export const projectSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  meta: projectMetaSchema,
  settings: projectSettingsSchema,
  elements: z.array(elementSchema),
  connections: z.array(connectionSchema),
  diagram: diagramSchema,
});

export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
export type ProjectMeta = z.infer<typeof projectMetaSchema>;
export type ProjectElement = z.infer<typeof elementSchema>;
export type PortRef = z.infer<typeof portRefSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type DiagramNode = z.infer<typeof diagramSchema>["nodes"][string];
export type Project = z.infer<typeof projectSchema>;
