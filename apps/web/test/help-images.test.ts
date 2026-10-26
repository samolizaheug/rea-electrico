import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import creditos from "../src/help/creditos.json";

const root = new URL("../", import.meta.url);
const exists = (p: string) => existsSync(new URL(p, root));

describe("imágenes de la ayuda de opciones", () => {
  it("cada foto con crédito existe en public/ayuda/", () => {
    for (const c of Object.values(creditos)) expect(exists(`public/ayuda/${c.file}`), c.file).toBe(true);
  });

  it("cada «photo» del catálogo tiene crédito", () => {
    const src = readFileSync(new URL("src/help/optionHelp.ts", root), "utf8");
    // photo: "clave" o photo: ["clave", ...]
    const keys = [...src.matchAll(/photo: (\[[^\]]*\]|"[^"]+")/g)].flatMap((m) => [...m[1]!.matchAll(/"([^"]+)"/g)].map((k) => k[1]!));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(Object.keys(creditos), k).toContain(k);
  });

  it("todos los métodos de instalación de la NOM tienen ayuda con foto", async () => {
    const { helpFor } = await import("../src/help/optionHelp");
    const { nom001Sede2012 } = await import("@rea/norms");
    const help = helpFor("installationMethod")!;
    const values = (nom001Sede2012.options("norm:installationMethods", {}) ?? []).map((o) => o.value);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(help[v]?.photo, v).toBeTruthy();
  });

  // Fotos de referencia locales (carpeta excluida de git): solo se revisan si existen.
  it.runIf(exists("public/ayuda-local/manifest.json"))("el manifiesto local apunta a archivos existentes", () => {
    const m = JSON.parse(readFileSync(new URL("public/ayuda-local/manifest.json", root), "utf8")) as {
      opciones: Record<string, { file: string }[]>;
      sinElemento?: { file: string }[];
    };
    const files = [...Object.values(m.opciones).flat(), ...(m.sinElemento ?? [])].map((p) => p.file);
    for (const f of files) expect(exists(`public/ayuda-local/${f}`), f).toBe(true);
  });
});
