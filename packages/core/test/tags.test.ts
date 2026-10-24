import { describe, expect, it } from "vitest";
import { formatTag, indexToLetters, lettersToIndex, nextFreeTag, parseTagIndex } from "../src";

describe("etiquetado automático", () => {
  it("formatea los tres estilos", () => {
    expect(formatTag("TR", "number", 1)).toBe("TR-1");
    expect(formatTag("M", "number2", 1)).toBe("M-01");
    expect(formatTag("M", "number2", 123)).toBe("M-123");
    expect(formatTag("TAB", "letter", 1)).toBe("TAB-A");
    expect(formatTag("TAB", "letter", 27)).toBe("TAB-AA");
  });

  it("convierte letras ↔ índice", () => {
    for (const n of [1, 2, 25, 26, 27, 52, 53, 702, 703]) expect(lettersToIndex(indexToLetters(n))).toBe(n);
    expect(indexToLetters(26)).toBe("Z");
    expect(indexToLetters(702)).toBe("ZZ");
  });

  it("toma el primer consecutivo libre, incluidos huecos", () => {
    expect(nextFreeTag([], "TR", "number")).toBe("TR-1");
    expect(nextFreeTag(["TR-1", "TR-3"], "TR", "number")).toBe("TR-2");
    expect(nextFreeTag(["TAB-A", "TAB-B"], "TAB", "letter")).toBe("TAB-C");
    expect(nextFreeTag(["M-01", "M-02", "TR-1"], "M", "number2")).toBe("M-03");
  });

  it("no confunde prefijos parecidos ni etiquetas editadas", () => {
    expect(parseTagIndex("TR-1", "T", "number")).toBeNull();
    expect(parseTagIndex("TAB-Principal", "TAB", "letter")).toBeNull();
    expect(nextFreeTag(["TAB-Principal"], "TAB", "letter")).toBe("TAB-A");
  });
});
