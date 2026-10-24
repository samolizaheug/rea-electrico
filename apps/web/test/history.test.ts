import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, commitFrom, initHistory, push, redo, replace, undo } from "../src/state/history";

describe("historial deshacer/rehacer", () => {
  it("deshace y rehace en orden", () => {
    let h = initHistory("a");
    h = push(h, "b");
    h = push(h, "c");
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    h = undo(h);
    expect(h.present).toBe("a");
    h = redo(h);
    expect(h.present).toBe("b");
  });

  it("un cambio nuevo descarta lo rehacible", () => {
    let h = push(push(initHistory("a"), "b"), "c");
    h = undo(h);
    h = push(h, "x");
    expect(h.future).toEqual([]);
    expect(redo(h).present).toBe("x");
  });

  it("un arrastre con muchos pasos queda como una sola entrada", () => {
    let h = initHistory("p0");
    const base = h.present;
    h = replace(h, "p1");
    h = replace(h, "p2");
    h = replace(h, "p3");
    h = commitFrom(h, base);
    expect(h.past).toEqual(["p0"]);
    expect(undo(h).present).toBe("p0");
  });

  it("no registra cambios nulos y limita el tamaño", () => {
    const h0 = initHistory("a");
    expect(push(h0, "a")).toBe(h0);
    let h = h0;
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) h = push(h, `s${i}`);
    expect(h.past.length).toBe(HISTORY_LIMIT);
  });
});
