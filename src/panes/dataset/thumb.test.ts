import { describe, expect, it } from "vitest";
import type { Graph } from "../../data/graph";
import { bakeThumb, parseThumb } from "./thumb";

// A path of n nodes: just what the bake reads.
const path = (n: number) =>
  ({
    n,
    m: n - 1,
    edgeSource: Uint32Array.from({ length: n - 1 }, (_, e) => e),
    edgeTarget: Uint32Array.from({ length: n - 1 }, (_, e) => e + 1),
    layoutOwn2d: Float32Array.from({ length: 2 * n }, (_, i) => (i % 2 ? Math.cos(i) : i)),
  }) as unknown as Graph;

const roundTrip = (g: Graph) => {
  const bytes = bakeThumb(g);
  return parseThumb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
};

const edgeKeys = (t: ReturnType<typeof parseThumb>) =>
  Array.from({ length: t.m }, (_, i) => `${t.edges[2 * i]}-${t.edges[2 * i + 1]}`).sort();

describe("thumbnails", () => {
  it("keep every edge and fit the picture inside the square", () => {
    const t = roundTrip(path(30));
    expect(t.n).toBe(30);
    expect(t.m).toBe(29);
    expect(edgeKeys(t)).toEqual(Array.from({ length: 29 }, (_, e) => `${e}-${e + 1}`).sort());
    const xs = Array.from(t.xy);
    // 85% of the square, centred: nothing reaches the edges.
    expect(Math.min(...xs)).toBeGreaterThan(0.07 * 65535);
    expect(Math.max(...xs)).toBeLessThan(0.93 * 65535);
  });

  it("bake the same bytes every time", () => {
    const g = path(30);
    expect(bakeThumb(g)).toEqual(bakeThumb(g));
  });
});
