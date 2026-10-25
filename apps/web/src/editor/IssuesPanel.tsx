import { useReactFlow } from "@xyflow/react";
import { t } from "../i18n";
import { useEditor } from "../state/store";
import { useValidation } from "../state/validation";

/** Lista de observaciones de validación; al hacer clic se seleccionan y enfocan los elementos. */
export function IssuesPanel({ onClose }: { onClose(): void }) {
  const v = useValidation();
  const flow = useReactFlow();
  const focus = (ids: string[]) => {
    useEditor.getState().select({ elements: ids, connections: [] });
    flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.8, duration: 300, maxZoom: 1.5 });
  };

  return (
    <section className="issues-panel" aria-label={t("issues.title")}>
      <header>
        <strong>{t("issues.title")}</strong>
        <span className="muted">{t("issues.summary", { errors: v.errors, warnings: v.warnings })}</span>
        <button onClick={onClose}>{t("issues.close")}</button>
      </header>
      {v.issues.length === 0 ? (
        <p className="muted">{t("issues.none")}</p>
      ) : (
        <ul>
          {v.issues.map((i, n) => (
            <li key={`${n}-${i.message}`}>
              <button className={`issue ${i.severity}`} onClick={() => focus(i.elementIds)}>
                <span className="dot" aria-hidden />
                <span className="origin">{t(`issues.${i.origin}`)}</span>
                <span>{i.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
