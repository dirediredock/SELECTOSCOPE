import { describe, expect, it } from "vitest";
import type { HopCensus } from "../../data/graph";
import { LEFT, arrival, censusOrder, censusStructure, censusXY, strideFor, sweepAxis } from "./geometry";

// The path a-b-c: from either end [1, 1, 0], from the middle [2, 0]. The
// ends are twins, one class.
const hc: HopCensus = {
  ecc: Uint32Array.of(2, 1, 2),
  offset: Uint32Array.of(0, 3, 5, 8),
  stubs: Uint32Array.of(1, 1, 0, 2, 0, 1, 1, 0),
};

// Rounded, and -0 read as 0, so float noise never fails a comparison.
const fixed = (a: ArrayLike<number>, digits = 4) => Array.from(a, (x) => +x.toFixed(digits) || 0);

describe("censusStructure", () => {
  it("bins by eccentricity, the smallest first, and finds the largest entry", () => {
    const st = censusStructure(hc);
    expect(st.eccs).toEqual([1, 2]);
    expect([...st.binOf]).toEqual([1, 0, 1]);
    expect(st.top).toBe(2);
    expect(st.maxEcc).toBe(2);
  });
});

describe("censusXY", () => {
  const p = censusXY(censusStructure(hc), hc, 100);

  it("stacks square bins with no gap, the smallest eccentricity on top", () => {
    expect(p.bins).toEqual([
      { ecc: 1, y0: 100, y1: 200 },
      { ecc: 2, y0: 0, y1: 100 },
    ]);
    expect(p.height).toBe(200);
  });

  it("starts every line at hop 0 and scales every bin by the graph's largest entry", () => {
    // An end's line peaks at 1 of the graph's 2, so half its bin's height.
    expect([...p.xy.slice(0, 6)]).toEqual([0, 50, 50, 50, 100, 0]);
    expect([...p.xy.slice(6, 10)]).toEqual([0, 200, 50, 100]);
  });
});

describe("sweepAxis", () => {
  // Bin 0 holds two identical lines; bin 1 three lines of three classes.
  const st = { n: 5, eccs: [1, 2], binOf: Uint32Array.of(1, 0, 1, 1, 0) };
  const order = {
    place: Float32Array.of(0.5, 0, 1, 0, 0),
    sweep: Float32Array.of(1 / 3, 0, 2 / 3, 0, 0),
  };
  const p = Array.from(sweepAxis(st, order).nodes!);

  it("runs down the bins, the top one first, each an equal share", () => {
    expect(p[1]).toBe(0);
    expect(p[4]).toBe(0);
    expect(Math.min(p[0]!, p[2]!, p[3]!)).toBe(0.5);
  });

  it("runs along the order within a bin, short of the next bin", () => {
    expect(p[3]).toBe(0.5);
    expect(p[0]).toBeCloseTo(0.5 + (1 / 3) * 0.5);
    expect(p[2]).toBeCloseTo(0.5 + (2 / 3) * 0.5);
  });

  it("runs along the lines' places sideways, every bin at once", () => {
    expect(fixed(sweepAxis(st, order, true).nodes!)).toEqual([0.5, 0, 1, 0, 0]);
  });

  it("runs along the places on the circle sideways when the band wraps", () => {
    expect(fixed(sweepAxis(st, order, true, true).nodes!)).toEqual([0.3333, 0, 0.6667, 0, 0]);
  });
});

describe("strideFor", () => {
  it("thins marks that come closer than minPx", () => {
    expect(strideFor(40, 12)).toBe(1);
    expect(strideFor(8, 12)).toBe(2);
    expect(strideFor(2, 12)).toBe(10);
    expect(strideFor(1, 6)).toBe(10);
  });
});

// One bin of three lines: two alike, [1, 2, 1], and one odd, [2, 1, 0]; and a
// bin of one line, [2, 0]. Reach (mean hop over eccentricity) ranks them
// [2, 0], then [2, 1, 0], then the twins: the nearest first.
const mixed: HopCensus = {
  ecc: Uint32Array.of(2, 2, 2, 1),
  offset: Uint32Array.of(0, 3, 6, 9, 11),
  stubs: Uint32Array.of(1, 2, 1, 1, 2, 1, 2, 1, 0, 2, 0),
};

// The path a-b-c-d-e: from an end [1, 1, 1, 1, 0], from its neighbour
// [2, 1, 1, 0], from the middle [2, 2, 0].
const path5: HopCensus = {
  ecc: Uint32Array.of(4, 3, 2, 3, 4),
  offset: Uint32Array.of(0, 5, 9, 12, 16, 21),
  stubs: Uint32Array.of(1, 1, 1, 1, 0, 2, 1, 1, 0, 2, 2, 0, 2, 1, 1, 0, 1, 1, 1, 1, 0),
};

describe("censusValues", () => {
  const { values } = censusStructure(mixed);

  it("reads reach as the mean hop, a share of the eccentricity", () => {
    expect(fixed(values.reach)).toEqual([0.5, 0.5, 0.1667, 0]);
  });

  it("reads degree as the first entry over the other nodes, degree centrality", () => {
    expect([...censusStructure(path5).values.degree]).toEqual([0.25, 0.5, 0.5, 0.5, 0.25]);
  });

  it("reads skew as the tail past the mean hop less the lead before it, a share of the eccentricity", () => {
    // An end [1, 1, 1, 1] and the middle [2, 2] are even, so neither is skewed;
    // the end's neighbour [2, 1, 1] starts heavy and trails off.
    expect(fixed(censusStructure(path5).values.skew)).toEqual([0, 0.1, 0, 0.1, 0]);
  });

  it("reads spread as the standard deviation in hops, a share of the eccentricity", () => {
    // An end [1, 1, 1, 1]: sd √1.25 over 4 hops; the middle [2, 2]: 0.5 over 2.
    expect(fixed(censusStructure(path5).values.spread)).toEqual([0.2795, 0.2764, 0.25, 0.2764, 0.2795]);
  });
});

describe("censusOrder", () => {
  const st = censusStructure(mixed);

  it("spaces the classes evenly from end to end, twins at one place", () => {
    expect([...censusOrder(st, "reach", true).place]).toEqual([1, 1, 0.5, 0]);
    expect([...censusOrder(censusStructure(hc), "reach", true).place]).toEqual([1, 0, 1]);
  });

  it("places each line at its value, scaled from end to end", () => {
    expect(fixed(censusOrder(st, "reach", false).place)).toEqual([1, 1, 0.3333, 0]);
  });

  it("puts each measure's own end left: Skew its long tails", () => {
    expect([...censusOrder(censusStructure(path5), "skew", true).place]).toEqual([1, 0, 1, 0, 1]);
  });

  it("puts the broadest shape left", () => {
    expect([...censusOrder(censusStructure(path5), "spread", true).place]).toEqual([0, 0.5, 1, 0.5, 0]);
  });

  it("keeps the ends that move lines least between orders", () => {
    expect(LEFT).toEqual({ degree: 1, reach: -1, spread: 1, skew: 1 });
  });

  it("puts the highest degree left", () => {
    expect([...censusOrder(st, "degree", true).place]).toEqual([1, 1, 0, 0]);
  });

  it("gives equal values one class, whatever their census", () => {
    // [2, 1, 1, 0] and [2, 2, 0] share degree 2, as do the path's ends at 1.
    expect([...censusOrder(censusStructure(path5), "degree", true).place]).toEqual([1, 0, 0, 0, 1]);
  });

  it("centres a single value, by rank or by value", () => {
    // The triangle: every line [2, 2].
    const tri: HopCensus = {
      ecc: Uint32Array.of(1, 1, 1),
      offset: Uint32Array.of(0, 2, 4, 6),
      stubs: Uint32Array.of(2, 2, 2, 2, 2, 2),
    };
    for (const byRank of [true, false]) {
      const order = censusOrder(censusStructure(tri), "reach", byRank);
      expect([...order.place]).toEqual([0.5, 0.5, 0.5]);
      expect([...order.sweep]).toEqual([0, 0, 0]);
    }
  });

  it("keeps a class's step after the last column on the sweep's circle", () => {
    const order = censusOrder(st, "reach", true);
    expect(fixed(order.sweep)).toEqual([0.6667, 0.6667, 0.3333, 0]);
    // Within a bin the band runs along the same places, short of the next bin.
    expect(fixed(sweepAxis(st, order).nodes!)).toEqual([0.8333, 0.8333, 0.6667, 0]);
  });

  it("slides lines right by their place", () => {
    const p = censusXY(st, mixed, 100, { slide: 2, place: censusOrder(st, "reach", true).place });
    // The near [2, 0] stays at hop 0; the odd line starts at +100, and the
    // far twins at the full +200.
    expect([p.xy[0], p.xy[4]]).toEqual([200, 300]);
    expect([p.xy[12], p.xy[16]]).toEqual([100, 200]);
    expect([p.xy[18], p.xy[20]]).toEqual([0, 50]);
  });
});

describe("arrival", () => {
  it("spreads each hop's entries over the hop, so the point moves smoothly", () => {
    // [2, 1, 1, 0]: half arrives over hop 0, so a tenth at -0.3 and nine
    // tenths past hop 1, at 2.1.
    expect(arrival([2, 1, 1, 0], 0.1)).toBeCloseTo(-0.3);
    expect(arrival([2, 1, 1, 0], 0.9)).toBeCloseTo(2.1);
    expect(arrival([1, 1, 1, 1], 0.5)).toBeCloseTo(1.5);
  });
});
