import { describe, expect, it } from "vitest";
import { edgeAt } from "./pointHits";

// Four nodes: a horizontal edge 0-1 at y = 0 and a vertical edge 2-3 that
// crosses it at x = 50.
const pos = Float32Array.of(0, 0, 100, 0, 50, -50, 50, 50);
const src = Uint32Array.of(0, 2);
const tgt = Uint32Array.of(1, 3);

describe("edgeAt", () => {
  it("finds the line nearest the cursor within reach", () => {
    expect(edgeAt(20, 3, pos, src, tgt, 2)).toBe(0);
    expect(edgeAt(52, 30, pos, src, tgt, 2)).toBe(1);
  });

  it("misses beyond reach, beside a line or past its end", () => {
    expect(edgeAt(20, 10, pos, src, tgt, 2)).toBeNull();
    expect(edgeAt(110, 0, pos, src, tgt, 2)).toBeNull();
  });

  it("takes the nearer line in depth where lines cross", () => {
    // Nodes 2 and 3 in front: edge 1 wins at the crossing, else edge 0.
    const front = Float32Array.of(-1, -1, 1, 1);
    expect(edgeAt(50, 0, pos, src, tgt, 2, front)).toBe(1);
    const back = Float32Array.of(1, 1, -1, -1);
    expect(edgeAt(50, 0, pos, src, tgt, 2, back)).toBe(0);
  });
});
