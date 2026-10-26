import { describe, expect, it } from "vitest";
import { touchFrame } from "./touchFrame";

describe("touchFrame", () => {
  it("centres two fingers at their midpoint, spread half their distance", () => {
    expect(touchFrame([{ x: 0, y: 0 }, { x: 6, y: 8 }])).toEqual({ x: 3, y: 4, spread: 5 });
  });

  it("keeps the spread when the fingers move together", () => {
    const a = touchFrame([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    const b = touchFrame([{ x: 7, y: 3 }, { x: 17, y: 3 }]);
    expect(b.spread).toBe(a.spread);
    expect([b.x - a.x, b.y - a.y]).toEqual([7, 3]);
  });

  it("doubles the spread when the fingers spread twice as far", () => {
    const a = touchFrame([{ x: 4, y: 4 }, { x: 6, y: 4 }]);
    const b = touchFrame([{ x: 3, y: 4 }, { x: 7, y: 4 }]);
    expect(b.spread / a.spread).toBe(2);
    expect(b.x).toBe(a.x);
  });
});
