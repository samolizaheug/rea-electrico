import { addElement, connect, createDefaultRegistry, createProject, moveElement, resizeBus, setConnectionSection, setSectionWidths, type ParamValue, type Project } from "@rea/core";
import { nodeGeometry, syncMccSections } from "@rea/symbols";

/** Elemento de una cadena: [etiqueta, tipo, parámetros]. */
export type Item = [tag: string, type: string, params?: Record<string, ParamValue>];

/** Puerto de entrada y de salida de cada tipo (para encadenar elementos). */
const PORTS: Record<string, [string | null, string | null]> = {
  utility: [null, "out"],
  generator: [null, "out"],
  breaker: ["line", "load"],
  cable: ["from", "to"],
  "cable-mt": ["from", "to"],
  transformer: ["primary", "secondary"],
  ups: ["in", "out"],
  vfd: ["in", "out"],
  ats: ["normal", "load"],
  panelboard: ["bus", "bus"],
  mcc: ["bus", "bus"],
  busbar: ["bus", "bus"],
  motor: ["in", null],
  luminaire: ["in", null],
  receptacle: ["in", null],
  "generic-load": ["in", null],
  "grouped-load": ["in", null],
};
const BUS_TYPES = new Set(["panelboard", "mcc", "busbar"]);

/** Separaciones del acomodo automático (px del diagrama). */
const COL = 175;
const GAP_Y = 46;
const BUS_GAP = 64;
const SIDE = 230;
/** Margen a cada lado de un CCM para que no quede pegado al vecino. */
const MCC_MARGIN = 30;

/**
 * Arma proyectos de ejemplo por cadenas (fuente → interruptor → cable → tablero → …) y acomoda el
 * unifilar automáticamente como árbol: cada barra reparte sus circuitos debajo, el CCM por secciones,
 * y la fuente de emergencia de un ATS queda a su derecha.
 */
export class Builder {
  readonly registry = createDefaultRegistry();
  p: Project;
  readonly ids: Record<string, string> = {};
  private readonly types: Record<string, string> = {};
  /** Sección del CCM de cada elemento conectado a un CCM (para el acomodo). */
  readonly sectionOf = new Map<string, number>();

  constructor(meta: { name: string; client: string; location: string; description: string }) {
    this.p = createProject({ ...meta, author: "Ing. RGLR" });
  }

  add(tag: string, type: string, params: Record<string, ParamValue> = {}): string {
    const r = addElement(this.p, this.registry, type, { tag, position: { x: 0, y: 0 }, params });
    this.p = r.project;
    this.ids[tag] = r.elementId;
    this.types[tag] = type;
    return tag;
  }

  /** Conecta «TAG.puerto» con «TAG.puerto»; en un CCM, `section` es la sección de la que sale. */
  wire(a: string, b: string, section?: number): void {
    const [ea, pa] = a.split(".") as [string, string];
    const [eb, pb] = b.split(".") as [string, string];
    const r = connect(this.p, this.registry, { elementId: this.ids[ea]!, portId: pa }, { elementId: this.ids[eb]!, portId: pb });
    this.p = r.project;
    if (section) {
      this.p = setConnectionSection(this.p, r.connectionId, section);
      this.sectionOf.set(this.ids[this.types[ea] === "mcc" ? eb : ea]!, section);
    }
  }

  /**
   * Cadena que sale de `from` («TAG.puerto» o una etiqueta, que usa su puerto de salida):
   * cada elemento se conecta a la salida del anterior. Devuelve la etiqueta del último.
   */
  chain(from: string, items: Item[], section?: number): string {
    let prev = from.includes(".") ? from : `${from}.${PORTS[this.types[from]!]![1]}`;
    items.forEach(([tag, type, params], i) => {
      this.add(tag, type, params);
      const [inPort, outPort] = PORTS[type]!;
      this.wire(prev, `${tag}.${inPort}`, i === 0 ? section : undefined);
      prev = `${tag}.${outPort}`;
    });
    return items.at(-1)![0];
  }

  /** Acomoda el diagrama y asigna las secciones del CCM. */
  finish(): Project {
    layout(this);
    return syncMccSections(this.p, this.registry);
  }

  typeOf(id: string): string {
    return this.p.elements.find((e) => e.id === id)!.type;
  }
}

// ---------------------------------------------------------------- acomodo automático

interface Link {
  other: string;
  myPort: string;
  otherPort: string;
}

function layout(b: Builder): void {
  const links = new Map<string, Link[]>();
  for (const c of b.p.connections) {
    (links.get(c.a.elementId) ?? links.set(c.a.elementId, []).get(c.a.elementId)!).push({ other: c.b.elementId, myPort: c.a.portId, otherPort: c.b.portId });
    (links.get(c.b.elementId) ?? links.set(c.b.elementId, []).get(c.b.elementId)!).push({ other: c.a.elementId, myPort: c.b.portId, otherPort: c.a.portId });
  }
  const root = b.p.elements.find((e) => e.type === "utility")?.id ?? b.p.elements[0]!.id;

  // Árbol desde la acometida; la entrada de emergencia de un ATS no se recorre (es una cadena lateral).
  const children = new Map<string, string[]>();
  const side = new Map<string, string[]>();
  const seen = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    const kids: string[] = [];
    for (const l of links.get(id) ?? []) {
      if (seen.has(l.other)) continue;
      if (b.typeOf(id) === "ats" && l.myPort === "emergency") continue;
      if (b.typeOf(l.other) === "ats" && l.otherPort === "emergency") continue;
      seen.add(l.other);
      kids.push(l.other);
      queue.push(l.other);
    }
    children.set(id, kids);
  }
  // Cadenas de emergencia: del ATS hacia su fuente.
  for (const e of b.p.elements.filter((x) => x.type === "ats")) {
    const chain: string[] = [];
    let prev = e.id;
    let cur = (links.get(e.id) ?? []).find((l) => l.myPort === "emergency")?.other;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      chain.push(cur);
      const next = (links.get(cur) ?? []).find((l) => l.other !== prev)?.other;
      prev = cur;
      cur = next;
    }
    side.set(e.id, chain);
  }

  const geo = (id: string) => nodeGeometry(b.p, b.registry, id)!;
  const isBus = (id: string) => BUS_TYPES.has(b.typeOf(id));
  const sectionsOf = (id: string) => {
    const n = Number(b.p.elements.find((e) => e.id === id)!.params.sections) || 1;
    const groups: string[][] = Array.from({ length: n }, () => []);
    for (const k of children.get(id) ?? []) groups[Math.min(n, b.sectionOf.get(k) ?? 1) - 1]!.push(k);
    return groups;
  };

  const secWidths = (id: string) => sectionsOf(id).map((g) => Math.max(150, g.reduce((s, k) => s + box(k).w, 0)));
  const sideHeight = (id: string) => (side.get(id) ?? []).reduce((s, k) => s + geo(k).height + GAP_Y, 0);

  /**
   * Espacio de cada subárbol: ancho total (w) y posición de su columna principal desde la izquierda (c).
   * La fuente lateral de un ATS ocupa espacio a la derecha sin mover la columna principal.
   */
  const memo = new Map<string, { w: number; c: number }>();
  const box = (id: string): { w: number; c: number } => {
    const hit = memo.get(id);
    if (hit) return hit;
    const kids = children.get(id) ?? [];
    const extra = side.get(id)?.length ? SIDE : 0;
    let r: { w: number; c: number };
    if (b.typeOf(id) === "mcc") {
      const w = secWidths(id).reduce((s, x) => s + x, 0) + 8 + 2 * MCC_MARGIN;
      r = { w, c: w / 2 };
    } else if (isBus(id)) {
      const w = Math.max(260, kids.reduce((s, k) => s + box(k).w, 0));
      r = { w, c: w / 2 };
    } else if (kids.length === 1) {
      const k = box(kids[0]!);
      const c = Math.max(COL / 2, k.c);
      r = { w: c + Math.max(COL / 2, k.w - k.c) + extra, c };
    } else if (kids.length > 1) {
      const w = kids.reduce((s, k) => s + box(k).w, 0);
      r = { w: w + extra, c: w / 2 };
    } else r = { w: COL + extra, c: COL / 2 };
    memo.set(id, r);
    return r;
  };

  const put = (id: string, cx: number, y: number) => {
    const g = geo(id);
    b.p = moveElement(b.p, id, cx - g.width / 2, y);
  };

  /** Coloca el subárbol en la región que empieza en `left`; `branchTop` = dónde empieza la rama (debajo de su barra). */
  const place = (id: string, left: number, y: number, branchTop: number): void => {
    const { w, c } = box(id);
    const cx = left + c;
    const kids = children.get(id) ?? [];
    if (b.typeOf(id) === "mcc") {
      const groups = sectionsOf(id);
      const widths = secWidths(id);
      b.p = resizeBus(b.p, id, w - 2 * MCC_MARGIN, left + MCC_MARGIN, y);
      b.p = setSectionWidths(b.p, id, widths);
      const below = y + geo(id).height + BUS_GAP;
      let x0 = left + MCC_MARGIN + 4;
      groups.forEach((g, i) => {
        const used = g.reduce((s, k) => s + box(k).w, 0);
        let x = x0 + (widths[i]! - used) / 2;
        for (const k of g) {
          place(k, x, below, below);
          x += box(k).w;
        }
        x0 += widths[i]!;
      });
      return;
    }
    if (isBus(id)) {
      const below = y + geo(id).height + BUS_GAP;
      const used = kids.reduce((s, k) => s + box(k).w, 0);
      let x = cx - used / 2;
      // La barra abarca sus circuitos (de la primera a la última columna) y queda centrada en su alimentación.
      let lo = cx;
      let hi = cx;
      for (const k of kids) {
        lo = Math.min(lo, x + box(k).c);
        hi = Math.max(hi, x + box(k).c);
        place(k, x, below, below);
        x += box(k).w;
      }
      const len = Math.max(220, hi - lo + 120);
      b.p = resizeBus(b.p, id, len, Math.min(lo - 60, cx - len / 2), y);
      return;
    }
    const g = geo(id);
    // Si tiene fuente lateral (ATS), baja lo necesario para que esa columna quepa debajo de la barra.
    const need = sideHeight(id);
    if (need) y = Math.max(y, branchTop + need - g.height / 2 + 10);
    put(id, cx, y);
    const below = y + g.height + GAP_Y;
    if (kids.length === 1) place(kids[0]!, cx - box(kids[0]!).c, below, branchTop);
    else {
      const used = kids.reduce((s, k) => s + box(k).w, 0);
      let x = cx - used / 2;
      for (const k of kids) {
        place(k, x, below, branchTop);
        x += box(k).w;
      }
    }
    // Fuente de emergencia del ATS: columna a la derecha, subiendo desde el ATS.
    let top = y + g.height / 2 - 10;
    for (const s of side.get(id) ?? []) {
      top -= geo(s).height + GAP_Y;
      put(s, cx + SIDE, top + GAP_Y);
    }
  };

  place(root, 0, 0, 0);
}
