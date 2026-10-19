import { describe, expect, it } from "vitest";
import { blobPath } from "./blob";

// A fixed sequence, so a shape can be checked.
function seq(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

describe("+ New's blob", () => {
  it("is one closed curve of smooth cubics", () => {
    const d = blobPath(seq(1));
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/C/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it("fits the thumbnail's square, its larger side at 85%", () => {
    for (let seed = 1; seed < 50; seed++) {
      const v = numbers(blobPath(seq(seed)));
      const xs = v.filter((_, i) => i % 2 === 0);
      const ys = v.filter((_, i) => i % 2 === 1);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      expect(Math.max(w, h)).toBeCloseTo(85, 1);
      expect(Math.min(...xs, ...ys)).toBeGreaterThanOrEqual(7.4);
      expect(Math.max(...xs, ...ys)).toBeLessThanOrEqual(92.6);
    }
  });

  it("differs from one draw to the next", () => {
    expect(blobPath(seq(1))).not.toBe(blobPath(seq(2)));
  });
});
