import { describe, expect, it } from "vitest";
import type { KSnakes } from "../../data/graph";
import { onionStride, snakeHeights, snakeStructure, snakeXY, sweepAxisX } from "./geometry";

// Two shells: K1 holds nodes 0-2 and 5 (onion 1-2), K3 holds nodes 3-4
// (onion 3). Islands {0, 1}, {2}, {5} and {3, 4}. Every ordering puts K1's
// singletons first; aggregated, they share one bin.
const row = Uint32Array.of(3, 2, 0, 0, 1, 1);
const every = (r: Uint32Array) => ({ packed: r, topdown: r });
const crossings = { packed: 0, topdown: 0 };
const ks: KSnakes = {
  core: Uint32Array.of(1, 1, 1, 3, 3, 1),
  onion: Uint32Array.of(1, 2, 1, 3, 3, 1),
  island: Uint32Array.of(1, 1, 0, 3, 3, 2),
  orders: {
    separate: { row: every(row), crossings },
    aggregate: { row: every(row), crossings },
  },
};

describe("snakeStructure", () => {
  const st = snakeStructure(ks);

  it("ranks shells and maps onion layers to them", () => {
    expect(st.cores).toEqual([1, 3]);
    expect([...st.shellOf]).toEqual([0, 0, 0, 1, 1, 0]);
    expect(st.onionRange).toEqual([
      [1, 2],
      [3, 3],
    ]);
    expect([...st.onionShell.slice(1)]).toEqual([0, 0, 1]);
  });

  it("splits each row into bins, one per island", () => {
    const o = st.orders.separate.packed;
    expect(o.rows.map((bins) => bins.map((b) => [...b.members]))).toEqual([[[2], [5], [1, 0]], [[3, 4]]]);
    expect(o.islands.map((g) => [...g])).toEqual([
      [1, 0],
      [3, 4],
    ]);
    expect(o.pills).toEqual([]);
  });

  it("piles a shell's singletons into one bin, a pill per onion layer", () => {
    const o = st.orders.aggregate.topdown;
    expect(o.rows[0]!.map((b) => [[...b.members], b.pile])).toEqual([
      [[2, 5], true],
      [[1, 0], false],
    ]);
    expect(o.pills.map((p) => [p.onion, [...p.members]])).toEqual([[1, [2, 5]]]);
  });
});

describe("snakeHeights", () => {
  const st = snakeStructure(ks);

  it("steps each layer and adds the gap at each K boundary", () => {
    const h = snakeHeights(st, 10, 30);
    expect([...h.onionY.slice(1)]).toEqual([0, 10, 50]);
    expect(h.height).toBe(50);
    expect(h.spans).toEqual([
      { k: 1, y0: 0, y1: 10 },
      { k: 3, y0: 50, y1: 50 },
    ]);
    expect(h.delimiters).toEqual([-20, 30, 70]);
    expect(h.bands).toEqual([
      [-20, 30],
      [30, 70],
    ]);
  });

  it("puts the inner delimiter between two layers when there is no gap", () => {
    expect(snakeHeights(st, 10, 0).delimiters).toEqual([-5, 15, 25]);
  });
});

describe("snakeXY", () => {
  const st = snakeStructure(ks);
  const { onionY } = snakeHeights(st, 10, 30);
  const xs = (p: { xy: Float32Array }) => [0, 1, 2, 3, 4, 5].map((v) => p.xy[2 * v]);

  it("sizes bins to their islands, justifies each row, and puts the end cuts half a slot outside", () => {
    const p = snakeXY(st, ks.onion, st.orders.separate.packed, onionY, 300, false);
    expect(xs(p)).toEqual([270, 210, 30, 120, 180, 90]);
    expect(p.cuts).toEqual([
      [-30, 60, 150, 330],
      [-30, 330],
    ]);
    expect(p.spacing).toBe(60);
  });

  it("rests each island against its right cut when flush right, and keeps the cuts", () => {
    const p = snakeXY(st, ks.onion, st.orders.separate.packed, onionY, 300, true);
    expect(xs(p)).toEqual([270, 210, 30, 210, 270, 90]);
    expect(p.cuts).toEqual([
      [-30, 60, 150, 330],
      [-30, 330],
    ]);
  });

  it("puts a pill's members at the pill", () => {
    const p = snakeXY(st, ks.onion, st.orders.aggregate.packed, onionY, 300, false);
    expect(xs(p)).toEqual([262.5, 187.5, 37.5, 112.5, 187.5, 37.5]);
    expect(p.cuts).toEqual([
      [-37.5, 112.5, 337.5],
      [-37.5, 337.5],
    ]);
    expect(p.spacing).toBe(75);
  });
});

// Three shells, every island a single node: K1 holds 0-3, K2 holds 4 and 6,
// K3 holds 5. Edges 0-4, 1-4, 2-6, 3-6, 4-5, 6-5, so both K2 nodes hang off 5
// and each K1 pair off one K2 node. K1 is the widest row.
const pulled: KSnakes = {
  core: Uint32Array.of(1, 1, 1, 1, 2, 3, 2),
  onion: Uint32Array.of(1, 1, 1, 1, 2, 3, 2),
  island: Uint32Array.of(0, 1, 2, 3, 4, 5, 6),
  orders: {
    separate: { row: every(Uint32Array.of(0, 1, 2, 3, 0, 0, 1)), crossings },
    aggregate: { row: every(Uint32Array.of(0, 1, 2, 3, 0, 0, 1)), crossings },
  },
};
const pull = { source: Uint32Array.of(0, 1, 2, 3, 4, 6), target: Uint32Array.of(4, 4, 6, 6, 5, 5) };

describe("snakeXY with a pull (Top-down)", () => {
  const st = snakeStructure(pulled);
  const { onionY } = snakeHeights(st, 10, 30);
  const xs = (p: { xy: Float32Array }) => [0, 1, 2, 3, 4, 5, 6].map((v) => p.xy[2 * v]);

  it("places a row under its neighbours, pushed apart only as far as the spacing needs", () => {
    const p = snakeXY(st, pulled.onion, st.orders.separate.topdown, onionY, 400, false, pull);
    // K2's two nodes both want x = 200, under node 5, and sit a slot apart around it.
    expect(xs(p)).toEqual([50, 150, 250, 350, 150, 200, 250]);
    expect(p.cuts[1]).toEqual([-50, 200, 450]);
  });

  it("keeps the widest row and the densest row justified", () => {
    const even = snakeXY(st, pulled.onion, st.orders.separate.topdown, onionY, 400, false);
    const p = snakeXY(st, pulled.onion, st.orders.separate.topdown, onionY, 400, false, pull);
    for (const v of [0, 1, 2, 3, 5]) expect(p.xy[2 * v]).toBe(even.xy[2 * v]);
    // Spread evenly, K2's nodes would sit at the ends of the row instead.
    expect([even.xy[8], even.xy[12]]).toEqual([50, 350]);
  });

  it("leaves Size alone", () => {
    const a = snakeXY(st, pulled.onion, st.orders.separate.packed, onionY, 400, true);
    const b = snakeXY(st, pulled.onion, st.orders.separate.packed, onionY, 400, true, pull);
    expect(xs(b)).toEqual(xs(a));
  });

  it("stays inside the row's width when every want is past its end", () => {
    const right = { source: Uint32Array.of(4, 6), target: Uint32Array.of(5, 5) };
    const p = snakeXY(st, pulled.onion, st.orders.separate.topdown, onionY, 400, false, right);
    for (const v of [4, 6]) {
      expect(p.xy[2 * v]).toBeGreaterThanOrEqual(50);
      expect(p.xy[2 * v]).toBeLessThanOrEqual(350);
    }
  });
});

describe("sweepAxisX", () => {
  it("runs left to right from the left end line to the right one", () => {
    const st = snakeStructure(ks);
    const { onionY } = snakeHeights(st, 10, 30);
    const p = snakeXY(st, ks.onion, st.orders.separate.packed, onionY, 300, false);
    // The end lines sit at -30 and 330: 360 across.
    expect(Array.from(sweepAxisX(p, 300).nodes!)).toEqual([300, 240, 60, 150, 210, 120].map((x) => x / 360));
  });
});

describe("onionStride", () => {
  it("labels every layer while they are far enough apart, then thins", () => {
    expect(onionStride(14)).toBe(1);
    expect(onionStride(10)).toBe(2);
    expect(onionStride(3)).toBe(5);
    expect(onionStride(0.5)).toBe(50);
  });
});
