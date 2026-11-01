import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/** Versión visible en la barra de estado: commit y fecha de la compilación (para saber si el navegador ya tiene la última). */
function appVersion(): string {
  let commit = "local";
  try {
    commit = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // Sin git: se queda como «local».
  }
  return `${commit} · ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // Rutas relativas: el sitio funciona igual en la raíz de un dominio o en una subcarpeta
  // (p. ej. https://usuario.github.io/rea-electrico/ en GitHub Pages).
  base: "./",
  server: { port: 5173, strictPort: true },
  build: {
    // pdfmake (con sus fuentes) y ExcelJS pesan cerca de 1 MB cada uno, pero se cargan solo al
    // exportar (import dinámico); no forman parte de la carga inicial del editor.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom"], flow: ["@xyflow/react"] },
      },
    },
  },
});
