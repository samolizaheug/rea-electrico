/**
 * Un símbolo es geometría pura (sin React ni DOM), en coordenadas locales con origen
 * arriba-izquierda y eje y hacia abajo. La rejilla del editor es de 20 px; las dimensiones y
 * los puertos caen sobre múltiplos de 20 para que las conexiones queden alineadas.
 * El color es siempre "currentColor": quien dibuja decide el color (normal, seleccionado, alerta).
 */
export type Primitive =
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; w?: number }
  | { k: "circle"; cx: number; cy: number; r: number; fill?: boolean }
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: boolean }
  | { k: "path"; d: string; fill?: boolean }
  | { k: "text"; x: number; y: number; text: string; size: number; weight?: "normal" | "bold" };

export type Side = "top" | "bottom" | "left" | "right";

export interface Anchor {
  x: number;
  y: number;
  side: Side;
}

export interface SymbolDef {
  key: string;
  width: number;
  height: number;
  /** Puntos de conexión por id de puerto. Un puerto de barra puede tener varios (arriba y abajo). */
  ports: Record<string, Anchor[]>;
  shapes: Primitive[];
  /**
   * Solo barras y tableros: la barra es horizontal y pasa por el centro del símbolo (sin rotar).
   * Las derivaciones se dibujan perpendiculares a la barra en cualquier punto de `halfLength`
   * alrededor del centro, partiendo a `halfThickness` del eje.
   */
  bus?: { halfLength: number; halfThickness: number };
}

export type Rotation = 0 | 90 | 180 | 270;
