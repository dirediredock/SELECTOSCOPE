import { describe, expect, it } from "vitest";
import { lassoMask } from "./lassoMask";

describe("lassoMask", () => {
  it("takes the inside of a simple loop", () => {
    const m = lassoMask([10, 10, 90, 10, 90, 90, 10, 90]);
    expect(m.contains(50, 50)).toBe(true);
    expect(m.contains(5, 50)).toBe(false);
    expect(m.contains(95, 95)).toBe(false);
    expect(m.contains(500, 500)).toBe(false);
  });

  it("leaves a concave notch out", () => {
    // A C open to the right.
    const m = lassoMask([10, 10, 90, 10, 90, 30, 30, 30, 30, 70, 90, 70, 90, 90, 10, 90]);
    expect(m.contains(20, 50)).toBe(true);
    expect(m.contains(60, 50)).toBe(false);
  });

  it("takes both lobes of a figure-8", () => {
    const m = lassoMask([10, 10, 90, 90, 90, 10, 10, 90]);
    expect(m.contains(20, 50)).toBe(true);
    expect(m.contains(80, 50)).toBe(true);
    expect(m.contains(50, 20)).toBe(false);
  });

  it("fills where the loop overshoots its start", () => {
    // Round once, then on past the start: the overlap is circled twice.
    const m = lassoMask([10, 10, 90, 10, 90, 90, 10, 90, 10, 10, 50, 10, 50, 50, 10, 50]);
    expect(m.contains(30, 30)).toBe(true);
    expect(m.contains(70, 70)).toBe(true);
  });

  it("fills a loop drawn inside another the other way round", () => {
    // Clockwise outer square, then a counter-clockwise inner one: the inner
    // region has winding 0, a hole under the nonzero rule.
    const m = lassoMask([10, 10, 90, 10, 90, 90, 10, 90, 10, 50, 30, 50, 30, 70, 70, 70, 70, 30, 30, 30, 30, 50, 10, 50]);
    expect(m.contains(50, 50)).toBe(true);
    expect(m.contains(20, 20)).toBe(true);
  });

  it("takes nothing with fewer than three points", () => {
    expect(lassoMask([10, 10, 90, 90]).contains(50, 50)).toBe(false);
  });
});
