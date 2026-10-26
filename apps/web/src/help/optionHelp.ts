/**
 * Ayuda visual de las opciones de los combos: texto, foto (Wikimedia Commons, licencia libre,
 * con crédito) o esquema propio cuando no hay foto libre adecuada.
 */
import { getLanguage } from "../i18n";
import creditos from "./creditos.json";

export interface PhotoCredit {
  file: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

type CreditKey = keyof typeof creditos;

export interface OptionHelp {
  text: { es: string; en: string };
  /** Clave de `creditos.json` (foto en public/ayuda/). */
  /** Claves de `creditos.json` (fotos en public/ayuda/): la primera es la principal; las demás, variantes. */
  photo?: CreditKey | CreditKey[];
  /** Pie de foto cuando la foto es solo representativa. */
  caption?: { es: string; en: string };
  /** Esquema SVG propio (usa currentColor). */
  svg?: string;
}

const L = (es: string, en: string) => ({ es, en });

// ---------------------------------------------------------------- Esquemas propios

const svgWrap = (body: string, h = 130) =>
  `<svg viewBox="0 0 260 ${h}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" font-family="Arial, sans-serif" font-size="12">${body}</svg>`;
const txt = (x: number, y: number, s: string, anchor = "start") => `<text x="${x}" y="${y}" fill="currentColor" stroke="none" text-anchor="${anchor}">${s}</text>`;
const ground = (x: number, y: number) => `<path d="M${x} ${y}v10M${x - 9} ${y + 10}h18M${x - 6} ${y + 14}h12M${x - 3} ${y + 18}h6"/>`;

/** Sistema: fuente y conductores con su tensión. */
function systemSvg(lines: string[], note: string): string {
  const y0 = 22;
  const step = 24;
  const body = lines
    .map((l, i) => {
      const y = y0 + i * step;
      const neutral = l === "N";
      return `<path d="M60 ${y}H230" ${neutral ? 'stroke-dasharray="6 4"' : ""}/>${txt(238, y + 4, l)}<circle cx="60" cy="${y}" r="3" fill="currentColor"/>`;
    })
    .join("");
  const h = y0 + lines.length * step + 20;
  return svgWrap(`<circle cx="30" cy="${y0 + ((lines.length - 1) * step) / 2}" r="18"/><path d="M20 ${y0 + ((lines.length - 1) * step) / 2}q5-8 10 0t10 0"/>${body}${txt(130, h - 8, note, "middle")}`, h);
}

/** Devanado en delta, estrella o estrella aterrizada. */
function winding(kind: string, cx: number, cy: number): string {
  if (kind === "D") return `<path d="M${cx} ${cy - 26}L${cx + 24} ${cy + 16}H${cx - 24}Z"/>`;
  const star = `<path d="M${cx} ${cy}V${cy - 28}M${cx} ${cy}L${cx + 24} ${cy + 14}M${cx} ${cy}L${cx - 24} ${cy + 14}"/>`;
  return kind === "YN" ? `${star}<path d="M${cx} ${cy}v22"/>${ground(cx, cy + 22)}` : star;
}

function connectionSvg(primary: string, secondary: string, label: string): string {
  return svgWrap(
    `${winding(primary, 60, 52)}${winding(secondary, 200, 52)}<path d="M100 52h60" stroke-dasharray="4 4"/>${txt(60, 118, "Primario", "middle")}${txt(200, 118, "Secundario", "middle")}${txt(130, 44, label, "middle")}`,
    125,
  );
}

const singlePhaseTransformerSvg = svgWrap(
  `<path d="M40 30c12 0 12 14 0 14s12 14 0 14s12 14 0 14"/><path d="M90 30c-12 0-12 14 0 14s-12 14 0 14s-12 14 0 14"/><path d="M62 24v62M68 24v62"/>${txt(40, 110, "H1-H2", "middle")}${txt(90, 110, "X1-X2", "middle")}${txt(180, 60, "Monofásico", "middle")}`,
  120,
);

const dualElementFuseSvg = svgWrap(
  `<rect x="20" y="40" width="220" height="44" rx="8"/><path d="M20 62H0M240 62h20"/>` +
    `<path d="M40 62h20l4-6 4 12 4-6h20" stroke-width="2.5"/>${txt(70, 30, "Elemento de cortocircuito", "middle")}` +
    `<rect x="120" y="52" width="26" height="20" rx="3" fill="currentColor" fill-opacity="0.15"/><path d="M146 62c6-10 10 10 16 0s10 10 16 0s10 10 16 0h26"/>` +
    `${txt(165, 104, "Elemento térmico (resorte y soldadura):", "middle")}${txt(165, 120, "retardo ante sobrecarga y arranque", "middle")}`,
  128,
);

const autotransformerStarterSvg = svgWrap(
  `<path d="M20 20h40M60 12v16M66 12v16M66 20h40"/>${txt(63, 44, "Arranque", "middle")}` +
    `<path d="M106 20v8c12 0 12 12 0 12s12 12 0 12s12 12 0 12s12 12 0 12v8"/>${ground(106, 84)}` +
    `<path d="M106 52h40"/>${txt(150, 48, "65 % / 80 %")}<path d="M146 52v30"/><circle cx="146" cy="96" r="14"/>${txt(146, 100, "M", "middle")}` +
    `<path d="M20 20V112h96M116 104v16M122 104v16M122 112h40V110"/>${txt(119, 98, "Marcha", "middle")}`,
  128,
);

// ---------------------------------------------------------------- Catálogo

const conduitText = {
  pvc: L(
    "Tubo rígido de PVC (cédula 40, 80 o tipo A). No metálico: no sirve como conductor de puesta a tierra, por lo que siempre lleva conductor de tierra de equipos. Común en instalaciones enterradas y ambientes corrosivos.",
    "Rigid PVC conduit (schedule 40, 80 or type A). Non-metallic: it cannot serve as the equipment grounding conductor, so a grounding conductor is always run. Common underground and in corrosive areas.",
  ),
  rmc: L(
    "Tubo metálico pesado (RMC) o semipesado (IMC) roscado. Máxima protección mecánica; para áreas industriales, exteriores y transiciones a subterráneo.",
    "Threaded rigid (RMC) or intermediate (IMC) metal conduit. Highest mechanical protection; for industrial areas, outdoors and underground transitions.",
  ),
  emt: L(
    "Tubo metálico ligero (EMT) de pared delgada, sin rosca; se une con coples y conectores de presión o tornillo. Uso general en interiores expuestos u ocultos.",
    "Thin-wall electrical metallic tubing (EMT), unthreaded; joined with set-screw or compression fittings. General use indoors, exposed or concealed.",
  ),
  flexible: L(
    "Tubo flexible (FMC metálico, LFMC metálico hermético a los líquidos o LFNC no metálico hermético). Se usa en tramos cortos hacia motores y equipos con vibración o que se mueven.",
    "Flexible conduit (FMC metal, LFMC liquid-tight metal or LFNC liquid-tight non-metallic). Used in short runs to motors and equipment subject to vibration or movement.",
  ),
};

const HELP: Record<string, Record<string, OptionHelp>> = {
  deviceType: {
    itm: {
      text: L(
        "Interruptor termomagnético: disparo térmico de tiempo inverso (sobrecarga) y magnético instantáneo (cortocircuito). Es el más común en tableros de alumbrado, contactos y fuerza.",
        "Thermal-magnetic circuit breaker: inverse-time thermal trip (overload) plus instantaneous magnetic trip (short circuit). The most common type in lighting, receptacle and power panels.",
      ),
      photo: "interruptor-termomagnetico",
    },
    electronico: {
      text: L(
        "Interruptor con unidad de disparo electrónica ajustable (largo tiempo, corto tiempo, instantáneo y, en su caso, falla a tierra). Normalmente en caja moldeada o de potencia, en capacidades medianas y grandes.",
        "Circuit breaker with an adjustable electronic trip unit (long time, short time, instantaneous and, if fitted, ground fault). Usually molded-case or power breakers in medium and large ratings.",
      ),
      photo: "interruptor-caja-moldeada-electronico",
    },
    instantaneo: {
      text: L(
        "Interruptor de disparo instantáneo (solo magnético, «protector de circuito de motor»). No protege contra sobrecarga: se usa en circuitos de motor junto con el relevador de sobrecarga del arrancador.",
        "Instantaneous-trip (magnetic-only) breaker, also called motor circuit protector. It does not protect against overload: it is used in motor circuits together with the starter's overload relay.",
      ),
      photo: "interruptor-caja-moldeada",
      caption: L("Foto representativa: por fuera es como un interruptor en caja moldeada; cambia la unidad de disparo.", "Representative photo: it looks like a molded-case breaker; the trip unit is what differs."),
    },
    "fusible-sin-retardo": {
      text: L(
        "Fusible de un solo elemento (sin retardo): abre rápido ante cualquier sobrecorriente. Con motores necesita un porcentaje mayor de la corriente a plena carga porque no tolera la corriente de arranque.",
        "Single-element (non-time-delay) fuse: opens quickly on any overcurrent. With motors it needs a higher percentage of full-load current because it does not ride through starting current.",
      ),
      photo: "fusible-cartucho",
    },
    "fusible-doble-elemento": {
      text: L(
        "Fusible de dos elementos (con retardo): un elemento térmico tolera sobrecargas breves y la corriente de arranque de motores; el elemento de cortocircuito abre rápido ante fallas.",
        "Dual-element (time-delay) fuse: a thermal element rides through short overloads and motor starting current; the short-circuit element opens quickly on faults.",
      ),
      svg: dualElementFuseSvg,
      caption: L("Esquema del interior (no hay foto de licencia libre).", "Internal sketch (no freely licensed photo available)."),
    },
  },
  starting: {
    directo: {
      text: L(
        "Arranque a tensión plena (directo): el contactor conecta el motor a la red. Corriente de arranque de 6 a 8 veces la nominal; es el más simple y barato.",
        "Full-voltage (across-the-line) starting: the contactor connects the motor to the supply. Starting current is 6 to 8 times rated; the simplest and cheapest method.",
      ),
      photo: "arrancador-contactor",
      caption: L("Contactor, el elemento principal del arrancador directo.", "Contactor, the main component of a full-voltage starter."),
    },
    "estrella-delta": {
      text: L(
        "Arranque estrella-delta: el motor arranca en estrella (≈ 1/3 de corriente y par) y luego pasa a delta. Requiere motor de 6 terminales diseñado para operar en delta.",
        "Star-delta starting: the motor starts in star (≈ 1/3 of current and torque) and then switches to delta. Requires a 6-lead motor designed to run in delta.",
      ),
      photo: "arrancador-estrella-delta",
    },
    autotransformador: {
      text: L(
        "Arranque por autotransformador: reduce la tensión de arranque con derivaciones (típicamente 50, 65 u 80 %) y después conecta el motor a tensión plena.",
        "Autotransformer starting: reduces starting voltage through taps (typically 50, 65 or 80 %) and then connects the motor at full voltage.",
      ),
      svg: autotransformerStarterSvg,
      caption: L("Esquema de un arrancador por autotransformador (no hay foto de licencia libre).", "Sketch of an autotransformer starter (no freely licensed photo available)."),
    },
    "arrancador-suave": {
      text: L(
        "Arrancador suave: tiristores que elevan la tensión gradualmente; limita la corriente y el golpe mecánico. Al terminar el arranque suele puentearse con un contactor.",
        "Soft starter: thyristors ramp the voltage up gradually, limiting current and mechanical shock. After starting it is usually bypassed by a contactor.",
      ),
      photo: "arrancador-suave",
    },
    variador: {
      text: L(
        "Variador de frecuencia: rectifica y genera tensión y frecuencia variables; arranca con corriente cercana a la nominal y controla la velocidad.",
        "Variable-frequency drive: rectifies and produces variable voltage and frequency; starts at near-rated current and controls speed.",
      ),
      photo: "variador-frecuencia",
    },
  },
  motorType: {
    jaula: { text: L("Motor de inducción con rotor de jaula de ardilla: el más usado en la industria; robusto y sin escobillas.", "Squirrel-cage induction motor: the most common industrial motor; rugged and brushless."), photo: "motor-jaula" },
    "jaula-b-eficiente": {
      text: L("Motor de jaula de ardilla de diseño B de alta eficiencia; su corriente de arranque puede ser mayor y la norma le da un porcentaje distinto para la protección instantánea.", "High-efficiency design B squirrel-cage motor; its inrush can be higher and the code gives it a different percentage for instantaneous protection."),
      photo: "motor-jaula",
    },
    "rotor-devanado": { text: L("Motor de rotor devanado: el rotor sale por anillos rozantes a resistencias externas para controlar el arranque.", "Wound-rotor motor: the rotor is brought out through slip rings to external resistors to control starting."), photo: "motor-rotor-devanado" },
    sincrono: { text: L("Motor síncrono: gira a velocidad de sincronismo; puede corregir el factor de potencia. Común en molinos y compresores grandes.", "Synchronous motor: runs at synchronous speed and can correct power factor. Common in large mills and compressors."), photo: "motor-sincrono" },
    cc: { text: L("Motor de corriente continua: conmutador y escobillas; se alimenta con rectificador o fuente de c.c.", "DC motor: commutator and brushes; supplied from a rectifier or DC source."), photo: "motor-cc" },
  },
  system: {
    "1F2H": { text: L("Monofásico, 2 hilos: una fase y neutro (p. ej. 127 V).", "Single-phase, 2-wire: one phase and neutral (e.g. 120/127 V)."), svg: systemSvg(["L", "N"], "V = V L-N") },
    "1F3H": { text: L("Monofásico, 3 hilos: dos fases y neutro (p. ej. 240/120 V).", "Single-phase, 3-wire: two phases and neutral (e.g. 240/120 V)."), svg: systemSvg(["L1", "N", "L2"], "V L1-L2 = 2 · V L-N") },
    "3F3H": { text: L("Trifásico, 3 hilos: tres fases sin neutro (p. ej. 480 V); cargas trifásicas o entre fases.", "Three-phase, 3-wire: three phases without neutral (e.g. 480 V); three-phase or line-to-line loads."), svg: systemSvg(["A", "B", "C"], "V L-L") },
    "3F4H": { text: L("Trifásico, 4 hilos: tres fases y neutro, p. ej. 220/127 V o 480/277 V (V L-N = V L-L / √3).", "Three-phase, 4-wire: three phases and neutral, e.g. 208/120 V or 480/277 V (V L-N = V L-L / √3)."), svg: systemSvg(["A", "B", "C", "N"], "V L-L / V L-N") },
  },
  connection: {
    Dyn1: { text: L("Delta en el primario y estrella aterrizada en el secundario, desfase de 30°. Da neutro en el secundario para cargas fase-neutro.", "Delta primary, grounded-wye secondary, 30° shift. Provides a secondary neutral for line-to-neutral loads."), svg: connectionSvg("D", "YN", "Dyn1") },
    Dyn5: { text: L("Delta - estrella aterrizada con desfase de 150°.", "Delta - grounded wye with 150° shift."), svg: connectionSvg("D", "YN", "Dyn5") },
    Dyn11: { text: L("Delta - estrella aterrizada con desfase de 330° (−30°); la más común en distribución IEC.", "Delta - grounded wye with 330° (−30°) shift; the most common in IEC distribution."), svg: connectionSvg("D", "YN", "Dyn11") },
    YNyn0: { text: L("Estrella aterrizada en ambos devanados, sin desfase.", "Grounded wye on both windings, no phase shift."), svg: connectionSvg("YN", "YN", "YNyn0") },
    Yyn0: { text: L("Estrella en el primario y estrella aterrizada en el secundario, sin desfase.", "Wye primary, grounded-wye secondary, no phase shift."), svg: connectionSvg("Y", "YN", "Yyn0") },
    Dd0: { text: L("Delta - delta, sin desfase; no da neutro en el secundario.", "Delta - delta, no phase shift; no secondary neutral."), svg: connectionSvg("D", "D", "Dd0") },
    Yd1: { text: L("Estrella - delta con desfase de 30°.", "Wye - delta with 30° shift."), svg: connectionSvg("Y", "D", "Yd1") },
    Yd11: { text: L("Estrella - delta con desfase de 330°.", "Wye - delta with 330° shift."), svg: connectionSvg("Y", "D", "Yd11") },
    "1F": { text: L("Transformador monofásico de dos devanados.", "Two-winding single-phase transformer."), svg: singlePhaseTransformerSvg },
  },
  installationMethod: {
    "conduit-pvc-40": { text: conduitText.pvc, photo: ["conduit-pvc-ced40"] },
    "conduit-pvc-80": { text: conduitText.pvc },
    "conduit-pvc-a": { text: conduitText.pvc },
    "conduit-hdpe": { text: L("Conduit de polietileno de alta densidad (HDPE), en rollos; para instalaciones enterradas y perforación direccional.", "High-density polyethylene (HDPE) conduit, supplied in coils; for underground runs and directional boring."), photo: ["conduit-hdpe-carretes", "conduit-ductos-polietileno"] },
    "conduit-ent": { text: L("Tubo no metálico (ENT) corrugado y flexible; para muros y losas, no para uso expuesto en áreas con daño físico.", "Corrugated, pliable electrical non-metallic tubing (ENT); for walls and slabs, not for exposed use where subject to damage."), photo: ["conduit-ent-azul"] },
    "conduit-rmc-acero": { text: conduitText.rmc, photo: ["conduit-rmc-instalado", "conduit-acero-roscado"] },
    "conduit-imc-acero": { text: conduitText.rmc },
    "conduit-rmc-aluminio": { text: conduitText.rmc },
    "conduit-rmc-inox": { text: conduitText.rmc, photo: ["conduit-rmc-inoxidable"] },
    "conduit-emt-acero": { text: conduitText.emt, photo: ["conduit-emt", "conduit-emt-sin-rosca"] },
    "conduit-emt-aluminio": { text: conduitText.emt },
    "conduit-fmc": { text: conduitText.flexible, photo: ["conduit-fmc", "conduit-fmc-acero", "conduit-fmc-instalado"] },
    "conduit-lfmc": { text: conduitText.flexible, photo: ["conduit-lfmc"] },
    "conduit-lfnc": { text: conduitText.flexible, photo: ["conduit-lfnc"] },
    "ducto-metalico": { text: L("Ducto metálico con tapa embisagrada (ducto cuadrado): canal para alojar varios circuitos, con acceso a lo largo de su recorrido.", "Metal wireway with hinged cover: a trough for several circuits, accessible along its length."), photo: ["ducto-metalico"] },
    "charola-escalera": { text: L("Charola portacables tipo escalera (o malla / fondo ventilado): largueros con travesaños; buena disipación de calor.", "Ladder (or wire-mesh / ventilated-bottom) cable tray: side rails with rungs; good heat dissipation."), photo: ["charola-escalera", "charola-escalera-cables", "charola-malla"] },
    "charola-fondo-solido": { text: L("Charola de fondo sólido: protege los cables de goteo y polvo, pero disipa menos calor (menor ampacidad que la tipo escalera).", "Solid-bottom cable tray: protects cables from dripping and dust but dissipates less heat (lower ampacity than ladder tray).") },
    "enterrado-directo": { text: L("Cables directamente enterrados en zanja, con profundidad mínima y protección según el artículo 300-5.", "Cables directly buried in a trench, with minimum cover and protection per article 300-5."), photo: ["enterrado-directo", "enterrado-directo-empalme"] },
    "enterrado-banco-pvc": { text: L("Banco de ductos enterrado: varios tubos agrupados, normalmente embebidos en concreto.", "Underground duct bank: several conduits grouped together, usually encased in concrete."), photo: ["banco-ductos", "banco-ductos-pvc"] },
    "enterrado-banco-pvc-eb": { text: L("Banco de ductos de PVC tipo EB embebido en concreto.", "Type EB PVC duct bank encased in concrete."), photo: "banco-ductos" },
    "aire-libre": { text: L("Conductores individuales al aire libre, separados, con libre circulación de aire (Tabla 310-15(b)(17)).", "Single insulated conductors in free air, spaced, with free air circulation (NOM Table 310-15(b)(17))."), photo: ["conductores-aire-libre"] },
  },
  insulationLevelPct: {
    "100": { text: L("Nivel de aislamiento 100 %: sistemas donde las fallas a tierra se liberan rápido (protección que opera en menos de 1 minuto).", "100 % insulation level: systems where ground faults are cleared quickly (protection operates in under 1 minute).") },
    "133": { text: L("Nivel de aislamiento 133 %: cuando la falla a tierra puede durar más de 1 minuto (p. ej. sistemas no aterrizados).", "133 % insulation level: when a ground fault may last more than 1 minute (e.g. ungrounded systems).") },
  },
  boardUse: {
    distribucion: { text: L("Tablero de distribución: alimenta otros tableros o equipos grandes.", "Distribution board: feeds other panels or large equipment.") },
    "alumbrado-contactos": { text: L("Tablero de alumbrado y contactos: circuitos derivados de alumbrado y receptáculos.", "Lighting and receptacle panel: lighting and receptacle branch circuits.") },
    fuerza: { text: L("Tablero de fuerza: circuitos de motores y equipos.", "Power panel: motor and equipment circuits.") },
  },
};

/** Parámetros que comparten la ayuda de otro (p. ej. todos los «sistema»). */
const ALIASES: Record<string, string> = { primarySystem: "system", inputSystem: "system" };

export function helpFor(paramKey: string): Record<string, OptionHelp> | undefined {
  return HELP[ALIASES[paramKey] ?? paramKey];
}

/** Notas de correspondencia de algunas fotos libres (cuando la foto es de referencia). */
const PHOTO_NOTES: Partial<Record<CreditKey, { es: string; en: string }>> = {
  "conduit-pvc-ced40": L("Tubo de PVC gris rotulado «SCH 40» (cédula 40).", "Gray PVC tube marked “SCH 40” (schedule 40)."),
  "conduit-acero-roscado": L("Tubo de acero galvanizado de pared gruesa (norma japonesa JIS, equivalente al RMC).", "Thick-wall galvanized steel conduit (Japanese JIS standard, RMC equivalent)."),
  "conduit-emt-sin-rosca": L("Tubo de acero de pared delgada sin rosca (norma japonesa JIS, equivalente al EMT).", "Thin-wall threadless steel conduit (Japanese JIS standard, EMT equivalent)."),
  "conduit-rmc-inoxidable": L("Tubos de acero inoxidable sujetos con abrazaderas (referencia del material).", "Stainless steel tubes held by clamps (material reference)."),
  "conduit-lfmc": L("Tramo flexible hermético entre un desconectador y una caja de paso, con conectores herméticos.", "Liquidtight flexible run between a disconnect and a conduit body, with liquidtight connectors."),
  "conduit-lfnc": L("Tubo flexible hermético gris llegando a gabinetes exteriores (referencia).", "Gray liquidtight flexible conduit entering outdoor enclosures (reference)."),
  "conduit-ductos-polietileno": L("Ductos de polietileno en rollo para tendido subterráneo.", "Polyethylene ducts in coils for underground runs."),
  "conductores-aire-libre": L("Conductores aislados individuales, separados y al aire sobre aisladores.", "Single insulated conductors, spaced, in free air on insulators."),
};

export type PublicPhoto = PhotoCredit & { key: string; src: string; note?: { es: string; en: string } };

/** Fotos libres de una opción, en orden (principal y variantes). */
export function photosOf(h: OptionHelp): PublicPhoto[] {
  const keys = h.photo === undefined ? [] : Array.isArray(h.photo) ? h.photo : [h.photo];
  return keys.flatMap((k) => {
    const c = (creditos as Record<string, PhotoCredit>)[k];
    return c ? [{ ...c, key: k, src: `${import.meta.env.BASE_URL}ayuda/${c.file}`, note: PHOTO_NOTES[k] }] : [];
  });
}

/** Nombre del sitio de origen de una foto libre, a partir de su URL. */
export function sourceSite(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (host.includes("wikimedia")) return "Wikimedia Commons";
  if (host.includes("flickr")) return "Flickr";
  if (host.includes("unsplash")) return "Unsplash";
  if (host.includes("pexels")) return "Pexels";
  if (host.includes("pixabay")) return "Pixabay";
  return host || "—";
}

export const pick = (s: { es: string; en: string }) => s[getLanguage()];

// ---------------------------------------------------------------- Fotos locales de referencia

/**
 * Fotos de referencia de fabricantes y distribuidores (derechos reservados, uso interno). Viven en
 * public/ayuda-local/, carpeta excluida de git: solo existen en la copia local y nunca se publican.
 * Si existen, se muestran en lugar de la foto libre; si no, la ayuda usa la foto libre o el texto.
 */
export interface LocalPhoto {
  file: string;
  /** Nombre técnico (texto alternativo y pie de foto). */
  nombre: string;
  /** Sitio de origen de la foto. */
  fuente: string;
  nota?: string;
  src: string;
}

let localPhotos: Promise<Record<string, LocalPhoto[]>> | undefined;

/** Fotos locales por valor de opción ({} si la carpeta no existe, como en la web publicada). */
export function loadLocalPhotos(): Promise<Record<string, LocalPhoto[]>> {
  localPhotos ??= fetch(`${import.meta.env.BASE_URL}ayuda-local/manifest.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: { opciones?: Record<string, Omit<LocalPhoto, "src">[]> }) =>
      Object.fromEntries(Object.entries(m.opciones ?? {}).map(([k, list]) => [k, list.map((p) => ({ ...p, src: `${import.meta.env.BASE_URL}ayuda-local/${p.file}` }))])),
    )
    .catch(() => ({}));
  return localPhotos;
}
