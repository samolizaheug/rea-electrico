import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
