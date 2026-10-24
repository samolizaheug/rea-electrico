import type { ElementCategory } from "@rea/core";
import { symbolFor, symbolToSvg } from "@rea/symbols";
import { t } from "../i18n";
import { registry } from "../state/registry";
import { useEditor, useProject } from "../state/store";
import { useReactFlow } from "@xyflow/react";
import { DND_TYPE } from "./Canvas";
import { snap } from "./geometry";

const CATEGORIES: ElementCategory[] = ["fuente", "transformacion", "distribucion", "carga"];

/** Biblioteca de elementos: se arrastra al lienzo, o doble clic para agregar al centro. */
export function Palette() {
  const symbology = useProject().settings.symbology;
  const flow = useReactFlow();
  return (
    <aside className="palette" aria-label={t("palette.title")}>
      <h2>{t("palette.title")}</h2>
      <p className="hint">{t("palette.hint")}</p>
      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h3>{t(`category.${cat}`)}</h3>
          <div className="palette-grid">
            {registry.byCategory(cat).map((def) => {
              const s = symbolFor(def, symbology);
              const scale = Math.min(1, 44 / Math.max(s.width, s.height));
              return (
                <button
                  key={def.type}
                  className="palette-item"
                  draggable
                  title={def.name}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_TYPE, def.type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDoubleClick={() => {
                    const box = document.querySelector(".canvas")?.getBoundingClientRect();
                    const p = box ? flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 }) : { x: 0, y: 0 };
                    useEditor.getState().add(def.type, { x: snap(p.x - s.width / 2), y: snap(p.y - s.height / 2) });
                  }}
                >
                  <span
                    className="palette-icon"
                    style={{ transform: `scale(${scale})` }}
                    dangerouslySetInnerHTML={{ __html: symbolToSvg(s) }}
                  />
                  <span className="palette-label">{def.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </aside>
  );
}
