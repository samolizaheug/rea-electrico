import { normModules } from "@rea/norms";
import { t } from "../i18n";
import { useEditor, useProject } from "../state/store";
import { TextInput } from "./fields";
import { NumberSetting } from "./NumberSetting";

/** Datos generales del proyecto y criterios de diseño (se muestra cuando no hay selección). */
export function ProjectPanel() {
  const p = useProject();
  const ed = useEditor.getState();
  const s = p.settings;
  const normKey = `${s.norm.id}@${s.norm.edition}`;

  return (
    <div className="properties">
      <fieldset>
        <legend>{t("project.general")}</legend>
        {(["name", "client", "location", "author"] as const).map((k) => (
          <div className="field" key={k}>
            <label htmlFor={`meta-${k}`}>{t(`project.${k}`)}</label>
            <TextInput id={`meta-${k}`} value={p.meta[k]} onCommit={(v) => (k !== "name" || v.trim()) && ed.setMeta({ [k]: v })} />
          </div>
        ))}
        <div className="field">
          <label htmlFor="meta-description">{t("project.description")}</label>
          <TextInput id="meta-description" multiline value={p.meta.description} onCommit={(v) => ed.setMeta({ description: v })} />
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("project.settings")}</legend>
        <div className="field">
          <label htmlFor="set-norm">{t("project.norm")}</label>
          <select
            id="set-norm"
            value={normKey}
            onChange={(e) => {
              const m = normModules.find((x) => `${x.id}@${x.edition}` === e.target.value);
              if (m) ed.setSettings({ norm: { id: m.id, edition: m.edition } });
            }}
          >
            {normModules.map((m) => (
              <option key={`${m.id}@${m.edition}`} value={`${m.id}@${m.edition}`} disabled={!m.available} title={m.unavailableReason}>
                {m.available ? m.label : t("project.normUnavailable", { norm: m.label })}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="set-sym">{t("project.symbology")}</label>
          <select id="set-sym" value={s.symbology} onChange={(e) => ed.setSettings({ symbology: e.target.value as "ANSI" | "IEC" })}>
            <option value="ANSI">ANSI / IEEE</option>
            <option value="IEC">IEC</option>
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="set-usize">{t("project.unitsSize")}</label>
            <select id="set-usize" value={s.units.conductorSize} onChange={(e) => ed.setSettings({ units: { ...s.units, conductorSize: e.target.value as "mm2" | "AWG" } })}>
              <option value="mm2">mm²</option>
              <option value="AWG">AWG / kcmil</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="set-ulen">{t("project.unitsLength")}</label>
            <select id="set-ulen" value={s.units.length} onChange={(e) => ed.setSettings({ units: { ...s.units, length: e.target.value as "m" | "ft" } })}>
              <option value="m">m</option>
              <option value="ft">ft</option>
            </select>
          </div>
        </div>
        <span className="field-help">{t("project.unitsNote")}</span>
        <div className="field">
          <label htmlFor="set-freq">{t("project.frequency")}</label>
          <select id="set-freq" value={s.frequencyHz} onChange={(e) => ed.setSettings({ frequencyHz: Number(e.target.value) as 50 | 60 })}>
            <option value={60}>60 Hz</option>
            <option value={50}>50 Hz</option>
          </select>
        </div>
        <NumberSetting id="set-air" label={t("project.ambientAir")} unit="°C" value={s.ambient.airC} min={-40} max={90} onCommit={(v) => ed.setSettings({ ambient: { ...s.ambient, airC: v } })} />
        <NumberSetting id="set-ground" label={t("project.ambientGround")} unit="°C" value={s.ambient.groundC} min={-20} max={60} onCommit={(v) => ed.setSettings({ ambient: { ...s.ambient, groundC: v } })} />
        <NumberSetting id="set-vdb" label={t("project.vdBranch")} unit="%" value={s.voltageDrop.branchPct} min={0.1} max={100} onCommit={(v) => ed.setSettings({ voltageDrop: { ...s.voltageDrop, branchPct: v } })} />
        <NumberSetting id="set-vdf" label={t("project.vdFeeder")} unit="%" value={s.voltageDrop.feederPct} min={0.1} max={100} onCommit={(v) => ed.setSettings({ voltageDrop: { ...s.voltageDrop, feederPct: v } })} />
        <NumberSetting id="set-vdt" label={t("project.vdTotal")} unit="%" value={s.voltageDrop.totalPct} min={0.1} max={100} onCommit={(v) => ed.setSettings({ voltageDrop: { ...s.voltageDrop, totalPct: v } })} />
        {s.norm.id === "nom-001-sede" ? <span className="field-help">{t("project.vdNote")}</span> : null}
      </fieldset>
    </div>
  );
}
