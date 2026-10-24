import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NormDataset, fingerprint, getNormDataset, sha256Hex } from "../src";

describe("huella de datos", () => {
  it("SHA-256 coincide con vectores de prueba conocidos", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(sha256Hex(enc(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(enc("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    // Mensajes de varios bloques y longitudes en el borde del relleno, contra la implementación de Node.
    for (const n of [55, 56, 63, 64, 65, 1000, 4097]) {
      const s = "ñ".repeat(n);
      expect(sha256Hex(enc(s))).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });

  it("no depende del orden de las claves", () => {
    expect(fingerprint({ a: 1, b: [1, 2] })).toBe(fingerprint({ b: [1, 2], a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
});

describe("verificación ligada a la huella", () => {
  const real = getNormDataset("nom-001-sede", "2012");
  const table = real.table("tabla-310-15-b-3-a", "adjustment-factors");

  it("una verificación vigente se reporta como tal", () => {
    const ds = new NormDataset("prueba", [table], {
      norm: table.norm,
      tables: { "tabla-310-15-b-3-a": { status: "verificado", fingerprint: fingerprint(table.data), by: "Ing. X", date: "2026-10-25" } },
    });
    expect(ds.status("tabla-310-15-b-3-a")).toMatchObject({ status: "verificado", by: "Ing. X" });
  });

  it("si los datos cambian, la verificación deja de valer", () => {
    const altered = structuredClone(table);
    altered.data.rows[0]!.percent = 81;
    const ds = new NormDataset("prueba", [altered], {
      norm: table.norm,
      tables: { "tabla-310-15-b-3-a": { status: "verificado", fingerprint: fingerprint(table.data), by: "Ing. X", date: "2026-10-25" } },
    });
    expect(ds.status("tabla-310-15-b-3-a").status).toBe("por_verificar");
    expect(ds.status("tabla-310-15-b-3-a").detail).toMatch(/cambiaron/);
  });

  it("verifica el tipo de tabla solicitado", () => {
    expect(() => real.table("tabla-310-15-b-3-a", "ampacity")).toThrow(/no "ampacity"/);
    expect(() => real.table("no-existe")).toThrow(/no existe/);
  });
});
