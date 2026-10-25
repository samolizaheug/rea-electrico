import { useEffect, useState } from "react";
import { t } from "../i18n";
import { parseNumber } from "./fields";

/** Número obligatorio con rango, para la configuración del proyecto. */
export function NumberSetting(props: { id: string; label: string; unit: string; value: number; min: number; max: number; onCommit(v: number): void }) {
  const { id, label, unit, value, min, max, onCommit } = props;
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText(String(value));
    setError(null);
  }, [value]);

  const commit = () => {
    const v = parseNumber(text);
    if (v === null || v === "invalid") return setError(t("field.invalidNumber"));
    if (v < min || v > max) return setError(`Debe estar entre ${min} y ${max}.`);
    setError(null);
    if (v !== value) onCommit(v);
  };

  return (
    <div className={`field${error ? " invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <span className="input-unit">
        <input id={id} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
        <span className="unit">{unit}</span>
      </span>
      {error ? <span className="field-msg error">{error}</span> : null}
    </div>
  );
}
