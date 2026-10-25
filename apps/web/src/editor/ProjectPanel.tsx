import { getNormModule, normModules } from "@rea/norms";
import { lib, t } from "../i18n";
import { adaptToNorm } from "../state/norm-switch";
import { useEditor, useProject } from "../state/store";
import { TextInput } from "./fields";
import { NumberSetting } from "./NumberSetting";

const PARAM_KEYS = ["insulationType", "installationMethod", "racewaySize", "forcedSize"] as const;
const paramLabel = (k: string) => ((PARAM_KEYS as readonly string[]).includes(k) ? t(`norm.param.${k as (typeof PARAM_KEYS)[number]}`) : k);

/** Datos generales del proyecto y criterios de diseño (se muestra cuando no hay selección). */
export function ProjectPanel() {
  const p = useProject();
  const ed = useEditor.getState();
  const s = p.settings;
  const normKey = `${s.norm.id}@${s.norm.edition}`;
  const vd = getNormModule(s.norm.id, s.norm.edition).voltageDrop;

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
              if (!m) return;
              const r = adaptToNorm(p, m);
              if (r.changes.length || r.settingsChanged.length) {
                const lines = [
                  ...r.changes.slice(0, 12).map((c) => `• ${c.tag}: ${Object.keys(c.params).map((k) => paramLabel(k)).join(", ")}`),
                  ...(r.changes.length > 12 ? [`• … y ${r.changes.length - 12} más`] : []),
                  ...(r.settingsChanged.length ? [`• ${t("norm.vdLimits")}: ${r.settingsChanged.join("; ")}`] : []),
                ];
                if (!confirm(t("norm.confirm", { norm: m.label, list: lines.join("\n") }))) return;
              }
              ed.replaceProject(r.project);
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
          <label htmlFor="set-lang">{t("project.language")}</label>
          <select id="set-lang" value={s.language} onChange={(e) => ed.setSettings({ language: e.target.value as "es" | "en" })}>
            <option value="es">Español</option>
            <option value="en">English</option>
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
        {(
          [
            ["set-vdb", "project.vdBranch", "branchPct", vd?.branch],
            ["set-vdf", "project.vdFeeder", "feederPct", vd?.feeder],
            ["set-vdt", "project.vdTotal", "totalPct", vd?.total],
          ] as const
        ).map(([id, label, key, limit]) => (
          <div key={id}>
            <NumberSetting
              id={id}
              label={t(label)}
              unit="%"
              value={s.voltageDrop[key]}
              min={0.1}
              // Los criterios del proyecto pueden ser más estrictos que la norma, nunca más permisivos.
              max={limit?.pct ?? 100}
              onCommit={(v) => ed.setSettings({ voltageDrop: { ...s.voltageDrop, [key]: v } })}
            />
            {limit ? <span className="field-help">{t("project.vdMax", { max: limit.pct, source: limit.source })}</span> : null}
          </div>
        ))}
        {vd?.special.length ? (
          <span className="field-help">
            {t("project.vdSpecial")}{" "}
            {vd.special
              .map(
                (sp) =>
                  `${lib(sp.label)}: ${[
                    sp.branch && t("project.vdSpecialBranch", { pct: sp.branch.pct }),
                    sp.total && t("project.vdSpecialTotal", { pct: sp.total.pct }),
                    sp.motorRunning && t("project.vdSpecialRunning", { pct: sp.motorRunning.pct }),
                    sp.motorStarting && t("project.vdSpecialStarting", { pct: sp.motorStarting.pct }),
                  ]
                    .filter(Boolean)
                    .join(", ")} (${(sp.branch ?? sp.motorRunning)?.source})`,
              )
              .join(" · ")}
          </span>
        ) : null}
        <NumberSetting
          id="set-unbalance"
          label={t("project.unbalance")}
          unit="%"
          value={s.phaseUnbalance.maxPct}
          min={0.1}
          max={100}
          onCommit={(v) => ed.setSettings({ phaseUnbalance: { maxPct: v } })}
        />
        <span className="field-help">{t("project.unbalanceNote")}</span>
      </fieldset>
    </div>
  );
}
