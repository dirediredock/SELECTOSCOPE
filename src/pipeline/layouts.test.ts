import { describe, expect, it } from "vitest";
import { ingest } from "./ingest";
import { flattened, forceDirected2d, forceDirected3d, isFlat, normalize, ownLayouts } from "./layouts";
import { harmonicVectors } from "./seriations";

const radius = (xy: Float64Array, dim: number) => {
  let r = 0;
  for (let v = 0; v < xy.length / dim; v++) {
    let s = 0;
    for (let a = 0; a < dim; a++) s += xy[v * dim + a] ** 2;
    r = Math.max(r, s);
  }
  return Math.sqrt(r);
};

describe("layouts", () => {
  it("normalizes to the unit bounding sphere", () => {
    expect(radius(normalize(Float64Array.from([10, 10, 12, 10, 11, 14]), 2), 2)).toBeCloseTo(1, 12);
    expect(radius(normalize(Float64Array.from([0, 0, 0, 2, 0, 0, 0, 3, 1]), 3), 3)).toBeCloseTo(1, 12);
  });

  it("reads a flat 3D as a 2D, exactly as drawn", () => {
    const flat = Float64Array.from([0, 0, 5, 4, 0, 5, 0, 1, 5, 4, 1, 5]);
    expect(isFlat(flat)).toBe(true);
    const own = ownLayouts(undefined, flat);
    expect(own.bespoke3d).toBeUndefined();
    expect(own.bespoke2d!.origin).toBe("derived");
    // A 4 x 1 rectangle keeps its shape: the widest axis first.
    const xy = flattened(flat);
    const w = Math.max(...[0, 2, 4, 6].map((i) => xy[i])) - Math.min(...[0, 2, 4, 6].map((i) => xy[i]));
    expect(w).toBeCloseTo(4, 9);
  });

  it("runs FD deterministically and reports frames", () => {
    const { graph } = ingest({ edgelist: "source,target\na,b\nb,c\nc,d\nd,a\na,c\nd,e\n" });
    const harm = harmonicVectors(graph);
    let frames = 0;
    const a = forceDirected2d(graph, harm, () => frames++);
    const b = forceDirected2d(graph, harm);
    expect(a).toEqual(b);
    expect(frames).toBeGreaterThan(0);
    expect(radius(a, 2)).toBeCloseTo(1, 12);
  });

  it("runs FD 3D deterministically, in three dimensions", () => {
    const { graph } = ingest({ edgelist: "source,target\na,b\nb,c\nc,d\nd,a\na,c\nd,e\ne,f\nf,a\n" });
    const harm = harmonicVectors(graph);
    const a = forceDirected3d(graph, harm);
    expect(a).toEqual(forceDirected3d(graph, harm));
    expect(a.length).toBe(3 * graph.n);
    expect(radius(a, 3)).toBeCloseTo(1, 12);
    expect(isFlat(a)).toBe(false);
  });
});
