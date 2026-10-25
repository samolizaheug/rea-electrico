import "@xyflow/react/dist/style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { useEditor } from "./state/store";
import "./styles.css";

// Solo en desarrollo: acceso al estado del editor desde la consola para depurar y probar.
if (import.meta.env.DEV) (window as unknown as { __rea: typeof useEditor }).__rea = useEditor;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
