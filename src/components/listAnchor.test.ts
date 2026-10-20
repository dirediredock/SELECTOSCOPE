import { describe, expect, it } from "vitest";
import { anchoredScrollTop } from "./listAnchor";

// Rows starting at `top`, each `h` high plus a 4 px gap.
const topsOf = (n: number, h: number, top = 18) => Array.from({ length: n + 1 }, (_, i) => top + i * (h + 4));

describe("anchoredScrollTop", () => {
  it("keeps the same point of the middle row at the middle", () => {
    const old = topsOf(20, 100), wide = topsOf(20, 200);
    const viewH = 400, st = 1000;
    const mid = st + viewH / 2; // in row 11, 0.28 through its span
    const r = Math.floor((mid - old[0]!) / 104);
    const f = (mid - old[r]!) / 104;
    expect(anchoredScrollTop(old, wide, st, viewH) + viewH / 2).toBeCloseTo(wide[r]! + f * 204);
  });

  it("leaves the scroll alone when nothing changed", () => {
    const t = topsOf(20, 100);
    expect(anchoredScrollTop(t, t, 777, 400)).toBeCloseTo(777);
  });

  it("leaves the scroll alone with the middle in the top inset", () => {
    expect(anchoredScrollTop(topsOf(5, 100, 300), topsOf(5, 200, 300), 0, 400)).toBe(0);
  });

  it("keeps the distance from the end with the middle past the last row", () => {
    const old = topsOf(3, 100), wide = topsOf(3, 200);
    const st = old[3]! + 50 - 200;
    expect(anchoredScrollTop(old, wide, st, 400)).toBeCloseTo(wide[3]! + 50 - 200);
  });
});
