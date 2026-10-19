import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bandSets,
  inBand,
  pressStep,
  registerSweepAxis,
  releaseStep,
  resumeSweep,
  setSweepSideways,
  startSweep,
  stopSweep,
  sweep,
  SWEEP_STEPS,
  wrapStep,
} from "./sweep";
import { toggleItem } from "./selection";
import { sweepAxis } from "../panes/matrix/geometry";

// The band reads the Select mode; the real store reads the page at load.
vi.mock("./uiStore", async () => {
  const { createStore } = await import("./createStore");
  return { ui: createStore({ selectMode: "both" }) };
});

// A path on 5 nodes: edge e joins e and e + 1.
const source = Uint32Array.of(0, 1, 2, 3);
const target = Uint32Array.of(1, 2, 3, 4);
// Nodes evenly down the axis: node v at v / 5.
const even = { nodes: Float64Array.of(0, 0.2, 0.4, 0.6, 0.8) };
// The default area: a fifth of the extent.
const BAND = 1 / 5;

const at = (p: number) => Math.round(p * SWEEP_STEPS); // the step whose band starts at p

describe("inBand", () => {
  it("takes [t, t + w)", () => {
    expect(inBand(0.3, 0.3, 0.2)).toBe(true);
    expect(inBand(0.49, 0.3, 0.2)).toBe(true);
    expect(inBand(0.5, 0.3, 0.2)).toBe(false);
    expect(inBand(0.29, 0.3, 0.2)).toBe(false);
  });

  it("wraps past 1 back to 0", () => {
    expect(inBand(0.05, 0.9, 0.2)).toBe(true);
    expect(inBand(0.95, 0.9, 0.2)).toBe(true);
    expect(inBand(0.11, 0.9, 0.2)).toBe(false);
  });
});

describe("bandSets in a node pane", () => {
  it("lights the nodes in the band and the edges they share", () => {
    // Band [0.2, 0.5): nodes 1 and 2, sharing edge 1.
    const { nodes, edges } = bandSets(even, at(0.2), 0.3, "both", source, target);
    expect([...nodes]).toEqual([1, 2]);
    expect([...edges]).toEqual([1]);
  });

  it("leaves an edge with one end outside", () => {
    const { nodes, edges } = bandSets(even, at(0.2), BAND, "both", source, target);
    expect([...nodes]).toEqual([1]);
    expect([...edges]).toEqual([]);
  });

  it("empties the set the mode leaves out", () => {
    expect([...bandSets(even, at(0.2), 0.3, "node", source, target).edges]).toEqual([]);
    expect([...bandSets(even, at(0.2), 0.3, "edge", source, target).nodes]).toEqual([]);
    expect([...bandSets(even, at(0.2), 0.3, "edge", source, target).edges]).toEqual([1]);
  });

  it("covers every node equally over a full cycle", () => {
    // Off the step boundaries, where float sums decide.
    const off = { nodes: Float64Array.of(0.01, 0.21, 0.41, 0.61, 0.81) };
    const hits = new Array(5).fill(0);
    for (let s = 0; s < SWEEP_STEPS; s++) for (const v of bandSets(off, s, BAND, "node", source, target).nodes) hits[v]++;
    expect(hits).toEqual([12, 12, 12, 12, 12]);
  });

  it("thickens with the band", () => {
    expect(bandSets(even, at(0), 0.5, "node", source, target).nodes.size).toBe(3);
    expect(bandSets(even, at(0), 0.01, "node", source, target).nodes.size).toBe(1);
  });
});

describe("bandSets in the matrix", () => {
  // Identity seriation: edge e at height 2e + 2 of 10, node v at 2v + 1.
  const diagonal = sweepAxis(Uint32Array.of(0, 1, 2, 3, 4), source, target);
  const sideways = sweepAxis(Uint32Array.of(0, 1, 2, 3, 4), source, target, true);

  it("places edges by row + col down the diagonal, and nodes by row sideways", () => {
    expect(Array.from(diagonal.edges!)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(diagonal.nodes).toBeUndefined();
    expect(Array.from(sideways.nodes!)).toEqual([0.1, 0.3, 0.5, 0.7, 0.9]);
    expect(sideways.edges).toBeUndefined();
  });

  it("lights edges by their own height down the diagonal, and their endpoints", () => {
    // Band [0.1, 0.25): edge 0 alone, so nodes 0 and 1.
    const { nodes, edges } = bandSets(diagonal, at(0.1), 0.15, "both", source, target);
    expect([...edges]).toEqual([0]);
    expect([...nodes]).toEqual([0, 1]);
  });

  it("still lights the endpoints under Nodes, and no nodes under Edges", () => {
    expect([...bandSets(diagonal, at(0.1), 0.15, "node", source, target).nodes]).toEqual([0, 1]);
    expect([...bandSets(diagonal, at(0.1), 0.15, "node", source, target).edges]).toEqual([]);
    expect([...bandSets(diagonal, at(0.1), 0.15, "edge", source, target).nodes]).toEqual([]);
  });

  it("lights rows sideways, and the edges between them", () => {
    // Band [0.1, 0.4): nodes 0 and 1, sharing edge 0.
    const { nodes, edges } = bandSets(sideways, at(0.1), 0.3, "both", source, target);
    expect([...nodes]).toEqual([0, 1]);
    expect([...edges]).toEqual([0]);
  });

  it("wraps past the bottom back to the top", () => {
    // Band [0.75, 1.05) wraps to [0, 0.05): edge 3 only.
    const { nodes, edges } = bandSets(diagonal, at(0.75), 0.3, "both", source, target);
    expect([...edges]).toEqual([3]);
    expect([...nodes]).toEqual([3, 4]);
  });
});

describe("wrapStep", () => {
  it("wraps at both ends", () => {
    expect(wrapStep(0, -1)).toBe(SWEEP_STEPS - 1);
    expect(wrapStep(SWEEP_STEPS - 1, 1)).toBe(0);
    expect(wrapStep(5, 3)).toBe(8);
    expect(wrapStep(2, -2 * SWEEP_STEPS - 3)).toBe(SWEEP_STEPS - 1);
  });
});

describe("stepping with the arrows", () => {
  // The clock is driven by hand: frames run only when `frame` is called.
  let now = 0;
  let pending: ((t: number) => void) | null = null;
  const frame = (t: number) => {
    now = t;
    const cb = pending;
    pending = null;
    cb?.(t);
  };

  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => ((pending = cb), 1));
    vi.stubGlobal("cancelAnimationFrame", () => (pending = null));
  });

  afterEach(() => {
    stopSweep();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does nothing with no sweep", () => {
    expect(pressStep(1)).toBe(false);
    expect(sweep.get().slot).toBe(null);
  });

  it("pauses a running sweep and steps it", () => {
    startSweep("s0");
    frame(700); // at 100%, a step is 4000 / 60 ms
    const at = sweep.get().step;
    expect(at).toBe(10);
    expect(pressStep(1)).toBe(true);
    releaseStep(1);
    expect(sweep.get()).toMatchObject({ paused: true, step: 11 });
    frame(5000);
    expect(sweep.get().step).toBe(11);
    pressStep(-1);
    releaseStep(-1);
    pressStep(-1);
    releaseStep(-1);
    expect(sweep.get().step).toBe(9);
  });

  it("moves at the Speed rate while held, past the hold delay", () => {
    startSweep("s0");
    pressStep(1);
    expect(sweep.get().step).toBe(1);
    frame(200);
    expect(sweep.get().step).toBe(1);
    frame(250 + 3.5 * (4000 / 60));
    expect(sweep.get().step).toBe(5);
    releaseStep(1);
    frame(5000);
    expect(sweep.get().step).toBe(5);
  });

  it("lets the last arrow pressed win", () => {
    startSweep("s0");
    pressStep(1);
    pressStep(-1);
    releaseStep(1);
    frame(250);
    expect(sweep.get().step).toBe(SWEEP_STEPS - 1);
  });

  it("resumes from the paused step", () => {
    startSweep("s0");
    pressStep(-1);
    releaseStep(-1);
    now = 10_000;
    resumeSweep();
    frame(10_001);
    expect(sweep.get()).toMatchObject({ paused: false, step: SWEEP_STEPS - 1 });
    frame(10_000 + 4000 / 60 + 1);
    expect(sweep.get().step).toBe(0);
  });

  it("reads the other axis at the same step when Sideways flips", () => {
    const reader = vi.fn(() => null);
    const unregister = registerSweepAxis("s0", reader);
    startSweep("s0");
    pressStep(1);
    releaseStep(1);
    setSweepSideways(true);
    expect(reader).toHaveBeenLastCalledWith(true);
    expect(sweep.get()).toMatchObject({ paused: true, step: 1 });
    setSweepSideways(false);
    unregister();
  });

  it("stops on a selection change while paused", () => {
    startSweep("s0");
    pressStep(1);
    toggleItem("node", 0);
    expect(sweep.get()).toMatchObject({ slot: null, paused: false });
  });
});
