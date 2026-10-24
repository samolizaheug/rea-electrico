import { createDefaultRegistry } from "@rea/core";
import { describe, expect, it } from "vitest";
import { getSymbol, rotatedAnchors, rotatedSize, symbolFor, symbolLibrary, symbolToSvg, type Rotation } from "../src";

const registry = createDefaultRegistry();
const GRID = 20;

describe("biblioteca de símbolos", () => {
  it("cada tipo de elemento tiene símbolo ANSI e IEC definidos", () => {
    for (const def of registry.list()) {
      expect(() => symbolFor(def, "ANSI"), def.type).not.toThrow();
      expect(() => symbolFor(def, "IEC"), def.type).not.toThrow();
    }
  });

  it("los puertos del símbolo coinciden con los del tipo de elemento, en el mismo lado", () => {
    for (const def of registry.list()) {
      for (const symbology of ["ANSI", "IEC"] as const) {
        const s = symbolFor(def, symbology);
        expect(Object.keys(s.ports).sort(), `${def.type} ${symbology}`).toEqual(def.ports.map((p) => p.id).sort());
        for (const port of def.ports) {
          const sides = s.ports[port.id]!.map((a) => a.side);
          expect(sides, `${def.type} ${symbology} ${port.id}`).toContain(port.side);
        }
      }
    }
  });

  it("dimensiones y puertos caen sobre la rejilla de 20 px y en el borde del símbolo", () => {
    for (const s of symbolLibrary) {
      expect(s.width % GRID, s.key).toBe(0);
      expect(s.height % GRID, s.key).toBe(0);
      for (const anchors of Object.values(s.ports)) {
        for (const a of anchors) {
          expect(a.x % GRID, `${s.key} x`).toBe(0);
          expect(a.y % GRID, `${s.key} y`).toBe(0);
          const onEdge = { top: a.y === 0, bottom: a.y === s.height, left: a.x === 0, right: a.x === s.width }[a.side];
          expect(onEdge, `${s.key} ${a.side}`).toBe(true);
        }
      }
    }
  });

  it("los tableros, CCM y barras declaran su barra; ningún otro símbolo lo hace", () => {
    for (const def of registry.list()) {
      for (const symbology of ["ANSI", "IEC"] as const) {
        const s = symbolFor(def, symbology);
        expect(!!s.bus, `${def.type} ${symbology}`).toBe(def.electricalRole === "bus");
        if (s.bus) expect(s.bus.halfLength * 2, s.key).toBeLessThanOrEqual(s.width);
      }
    }
  });

  it("ANSI e IEC del mismo tipo tienen las mismas dimensiones y puertos (cambiar simbología no mueve conexiones)", () => {
    for (const def of registry.list()) {
      const a = symbolFor(def, "ANSI");
      const i = symbolFor(def, "IEC");
      expect([a.width, a.height], def.type).toEqual([i.width, i.height]);
      expect(a.ports, def.type).toEqual(i.ports);
    }
  });
});

describe("rotación", () => {
  const t = getSymbol("ansi/transformer-2w");

  it("intercambia dimensiones a 90° y 270°", () => {
    expect(rotatedSize(t, 90)).toEqual({ width: 100, height: 40 });
    expect(rotatedSize(t, 180)).toEqual({ width: 40, height: 100 });
  });

  it("gira los puertos en sentido horario", () => {
    const cases: [Rotation, { x: number; y: number; side: string }][] = [
      [0, { x: 20, y: 0, side: "top" }],
      [90, { x: 100, y: 20, side: "right" }],
      [180, { x: 20, y: 100, side: "bottom" }],
      [270, { x: 0, y: 20, side: "left" }],
    ];
    for (const [r, expected] of cases) expect(rotatedAnchors(t, r).primary![0]).toEqual(expected);
  });

  it("serializa a SVG válido", () => {
    const svg = symbolToSvg(getSymbol("iec/motor"), 90);
    expect(svg).toMatch(/^<svg [^>]*width="60" height="40"/);
    expect(svg).toContain('transform="translate(60 0) rotate(90)"');
  });
});
