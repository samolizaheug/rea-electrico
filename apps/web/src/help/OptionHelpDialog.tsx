import type { EnumOption, ParamValue } from "@rea/core";
import { useEffect, useState } from "react";
import { lib, t } from "../i18n";
import { helpFor, loadLocalPhotos, photoOf, pick, type LocalPhoto, type OptionHelp } from "./optionHelp";

/**
 * Botón «?» junto a un combo: abre un cuadro con todas las opciones ilustradas
 * (foto con su crédito o esquema) y permite elegir una con un clic.
 */
export function OptionHelpButton({ paramKey, label, options, value, onCommit }: { paramKey: string; label: string; options: EnumOption[]; value: ParamValue; onCommit(v: ParamValue): void }) {
  const [open, setOpen] = useState(false);
  const help = helpFor(paramKey);
  if (!help || !options.some((o) => help[o.value])) return null;
  return (
    <>
      <button type="button" className="help-btn" title={t("help.options")} aria-label={t("help.options")} onClick={() => setOpen(true)}>
        ?
      </button>
      {open ? (
        <OptionHelpDialog
          label={label}
          options={options}
          value={value}
          help={help}
          onClose={() => setOpen(false)}
          onPick={(v) => {
            if (v !== value) onCommit(v);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function OptionHelpDialog({ label, options, value, help, onClose, onPick }: { label: string; options: EnumOption[]; value: ParamValue; help: NonNullable<ReturnType<typeof helpFor>>; onClose(): void; onPick(v: string): void }) {
  const [local, setLocal] = useState<Record<string, LocalPhoto[]>>({});
  useEffect(() => {
    let alive = true;
    void loadLocalPhotos().then((m) => alive && setLocal(m));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-dialog" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{label}</h3>
          <button type="button" onClick={onClose}>
            {t("help.close")}
          </button>
        </header>
        <p className="muted small">{t("help.pickHint")}</p>
        <div className="help-grid">
          {options.map((o) => (
            <OptionCard key={o.value} option={o} help={help[o.value]} local={local[o.value] ?? []} selected={o.value === value} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionCard({ option, help: h, local, selected, onPick }: { option: EnumOption; help: OptionHelp | undefined; local: LocalPhoto[]; selected: boolean; onPick(v: string): void }) {
  const [variant, setVariant] = useState(0);
  const photo = h ? photoOf(h) : undefined;
  const ref = local[Math.min(variant, local.length - 1)];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={`help-card${selected ? " selected" : ""}`}
      onClick={() => onPick(option.value)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(option.value))}
    >
      <div className="help-media">
        {ref ? (
          <img src={ref.src} alt={ref.nombre} loading="lazy" />
        ) : photo ? (
          <img src={photo.src} alt={lib(option.label)} loading="lazy" />
        ) : h?.svg ? (
          <span className="help-svg" dangerouslySetInnerHTML={{ __html: h.svg }} />
        ) : (
          <span className="muted small">{t("help.noImage")}</span>
        )}
      </div>
      {local.length > 1 ? (
        <div className="help-variants" onClick={(e) => e.stopPropagation()}>
          {local.map((p, i) => (
            <button key={p.file} type="button" title={p.nombre} aria-label={p.nombre} aria-pressed={i === variant} className={i === variant ? "active" : ""} onClick={() => setVariant(i)}>
              <img src={p.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <strong>{lib(option.label)}</strong>
      {h ? <span className="help-text">{pick(h.text)}</span> : null}
      {ref ? (
        <>
          <span className="help-caption">{ref.nombre}</span>
          {ref.nota ? <span className="help-caption">{ref.nota}</span> : null}
          <span className="help-credit">{t("help.localPhoto", { source: ref.fuente })}</span>
        </>
      ) : (
        <>
          {h?.caption ? <span className="help-caption">{pick(h.caption)}</span> : null}
          {photo ? (
            <span className="help-credit" onClick={(e) => e.stopPropagation()}>
              {t("help.photo")}: {photo.author || "—"} ·{" "}
              <a href={photo.licenseUrl || photo.source} target="_blank" rel="noreferrer">
                {photo.license}
              </a>{" "}
              ·{" "}
              <a href={photo.source} target="_blank" rel="noreferrer">
                Wikimedia Commons
              </a>
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
