import type { EnumOption, ParamDef, ParamIssue, ParamValue } from "@rea/core";
import { useEffect, useState } from "react";
import { t } from "../i18n";

/** Convierte texto capturado a número; acepta coma decimal. Vacío = null. */
export function parseNumber(text: string): number | null | "invalid" {
  const s = text.trim().replace(",", ".");
  if (s === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : "invalid";
}

interface FieldProps {
  def: ParamDef;
  value: ParamValue;
  /** Opciones resueltas para enums con proveedor de la norma (undefined = la norma no las tiene). */
  providerOptions?: EnumOption[];
  issues: ParamIssue[];
  onCommit(value: ParamValue): void;
}

/** Campo de captura genérico, construido a partir de la definición del parámetro. */
export function ParamField({ def, value, providerOptions, issues, onCommit }: FieldProps) {
  const id = `param-${def.key}`;
  const error = issues.find((i) => i.severity === "error");
  return (
    <div className={`field${error ? " invalid" : ""}`}>
      <label htmlFor={id} title={def.description}>
        {def.label}
      </label>
      <Control id={id} def={def} value={value} providerOptions={providerOptions} onCommit={onCommit} />
      {issues.map((i) => (
        <span key={i.message} className={`field-msg ${i.severity}`}>
          {i.message.replace(`${def.label}: `, "")}
        </span>
      ))}
      {def.description && !issues.length ? <span className="field-help">{def.description}</span> : null}
    </div>
  );
}

function Control({ id, def, value, providerOptions, onCommit }: { id: string } & Omit<FieldProps, "issues">) {
  switch (def.kind) {
    case "number":
      return <NumberInput id={id} unit={def.unit} value={typeof value === "number" ? value : null} onCommit={onCommit} />;
    case "enum": {
      const options = Array.isArray(def.options) ? def.options : providerOptions;
      if (!options) return <span className="field-help">{t("field.noNormData")}</span>;
      const current = typeof value === "string" ? value : "";
      const known = options.some((o) => o.value === current);
      return (
        <select id={id} value={current} onChange={(e) => onCommit(e.target.value === "" ? null : e.target.value)}>
          {!def.required || !current ? <option value="">{def.required ? t("field.none") : t("field.auto")}</option> : null}
          {!known && current ? <option value={current}>{current} (no válido)</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "boolean":
      return <input id={id} type="checkbox" checked={value === true} onChange={(e) => onCommit(e.target.checked)} />;
    case "string":
      return <TextInput id={id} value={typeof value === "string" ? value : ""} onCommit={onCommit} />;
  }
}

function NumberInput({ id, unit, value, onCommit }: { id: string; unit?: string; value: number | null; onCommit(v: ParamValue): void }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(value === null ? "" : String(value));
    setBad(false);
  }, [value]);
  const commit = () => {
    const v = parseNumber(text);
    if (v === "invalid") return setBad(true);
    setBad(false);
    if (v !== value) onCommit(v);
  };
  return (
    <span className="input-unit">
      <input
        id={id}
        inputMode="decimal"
        value={text}
        aria-invalid={bad}
        title={bad ? t("field.invalidNumber") : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {unit && unit !== "pu" ? <span className="unit">{unit}</span> : unit === "pu" ? <span className="unit">p.u.</span> : null}
    </span>
  );
}

export function TextInput({ id, value, onCommit, multiline }: { id: string; value: string; onCommit(v: string): void; multiline?: boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => text !== value && onCommit(text);
  return multiline ? (
    <textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
  ) : (
    <input id={id} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
  );
}
