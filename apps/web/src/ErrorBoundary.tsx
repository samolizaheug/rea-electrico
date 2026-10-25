import { Component, type ReactNode } from "react";
import { t } from "./i18n";
import { downloadProject } from "./io/files";
import { useEditor } from "./state/store";

/**
 * Si un componente falla al dibujarse, muestra un aviso en lugar de una pantalla en blanco.
 * El proyecto sigue en memoria (y en el autoguardado), así que se ofrece descargarlo.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error("Error en la interfaz:", error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>{t("error.title")}</h1>
        <p>{t("error.detail")}</p>
        <pre>{this.state.error.message}</pre>
        <div className="actions">
          <button onClick={() => location.reload()}>{t("error.reload")}</button>
          <button onClick={() => downloadProject(useEditor.getState().history.present)}>{t("error.download")}</button>
        </div>
      </div>
    );
  }
}
