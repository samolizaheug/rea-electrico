import type { ParamValue, ProjectElement } from "@rea/core";
import { mccLayout } from "@rea/symbols";
import { ParamHelpButton } from "../help/OptionHelpDialog";
import { t } from "../i18n";
import { useEditor } from "../state/store";
import { NumberInput } from "./fields";

/**
 * Configuración del CCM en forma gráfica: número de secciones, bus horizontal arriba y el bus vertical
 * de cada sección debajo (común a todas o, en casos especiales, uno por sección).
 */
export function MccConfig({ element }: { element: ProjectElement }) {
  const ed = useEditor.getState();
  const { sections, vertical } = mccLayout(element.params);
  const perSection = String(element.params.verticalBusBySection ?? "").trim() !== "";
  const common = typeof element.params.verticalBusA === "number" ? element.params.verticalBusA : null;
  const set = (changes: Record<string, ParamValue>) => ed.setParams(element.id, changes);

  const setSections = (n: number) => {
    const next = Math.max(1, Math.min(30, n));
    if (next === sections) return;
    const changes: Record<string, ParamValue> = { sections: next };
    if (perSection) {
      // Conserva los valores por sección y completa las nuevas con el último (o el común).
      const vals = Array.from({ length: next }, (_, i) => vertical[i] ?? vertical[sections - 1] ?? common ?? "");
      changes.verticalBusBySection = vals.join(", ");
    }
    ed.setMccSections(element.id, next, changes);
  };
  const setVertical = (i: number, v: ParamValue) => {
    const vals = Array.from({ length: sections }, (_, k) => (k === i ? v : (vertical[k] ?? common ?? "")));
    set({ verticalBusBySection: vals.map((x) => (typeof x === "number" ? x : "")).join(", ") });
  };

  return (
    <fieldset className="mcc-config">
      <legend>
        {t("mcc.title")} <ParamHelpButton paramKey="mccConfig" label={t("mcc.title")} />
      </legend>

      <div className="mcc-row">
        <span>{t("mcc.sections")}</span>
        <span className="mcc-stepper">
          <button type="button" aria-label={t("mcc.less")} onClick={() => setSections(sections - 1)} disabled={sections <= 1}>
            −
          </button>
          <strong>{sections}</strong>
          <button type="button" aria-label={t("mcc.more")} onClick={() => setSections(sections + 1)}>
            +
          </button>
        </span>
      </div>

      <div className="mcc-drawing">
        <div className="mcc-h">
          <span className="mcc-tag">{t("mcc.horizontal")}</span>
          <NumberInput id="mcc-h" unit="A" value={typeof element.params.horizontalBusA === "number" ? element.params.horizontalBusA : null} onCommit={(v) => set({ horizontalBusA: v })} />
        </div>
        <div className="mcc-hbar" />
        <div className="mcc-sections">
          {Array.from({ length: sections }, (_, i) => (
            <div key={i} className="mcc-section">
              <div className="mcc-vbar" />
              <span className="mcc-tag">S{i + 1}</span>
              {perSection ? (
                <NumberInput id={`mcc-v-${i}`} unit="A" value={vertical[i] ?? null} onCommit={(v) => setVertical(i, v)} />
              ) : (
                <span className="mcc-value">{common !== null ? `${common} A` : "—"}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {!perSection ? (
        <div className="mcc-row">
          <span>{t("mcc.vertical")}</span>
          <NumberInput id="mcc-v" unit="A" value={common} onCommit={(v) => set({ verticalBusA: v })} />
        </div>
      ) : null}
      <label className="mcc-check">
        <input
          type="checkbox"
          checked={perSection}
          onChange={(e) =>
            set({ verticalBusBySection: e.target.checked ? Array.from({ length: sections }, () => common ?? "").join(", ") : "" })
          }
        />
        {t("mcc.perSection")}
      </label>
    </fieldset>
  );
}
