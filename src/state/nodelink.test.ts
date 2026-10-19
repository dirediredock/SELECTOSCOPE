import { describe, expect, it } from "vitest";
import type { Graph, OpeningView } from "../data/graph";
import { hasLayout, layoutPositions, LIVE_MAX_NODES, openingSettings } from "./nodelink";

// Just what the layouts read: the size and the layouts. A graph has FD
// always, FD in 3D once it is computed, and maybe its own 2D and 3D.
const graph = (n: number, { own2d = true, own3d = false, fd3d = true, view = null as OpeningView } = {}) =>
  ({
    n,
    m: n - 1,
    view,
    layoutFd: new Float32Array(2 * n),
    layoutFd3d: fd3d ? new Float32Array(3 * n) : null,
    layoutOwn2d: own2d ? new Float32Array(2 * n) : null,
    layoutOwn3d: own3d ? new Float32Array(3 * n) : null,
  }) as Graph;
// A bare edge list: FD, and FD in 3D.
const bare = (n: number) => graph(n, { own2d: false });
// A native shape: its own 3D, and a 2D derived from it.
const shape = (n: number) => graph(n, { own3d: true, fd3d: false });

describe("layouts", () => {
  it("2D is FD, there for every graph", () => {
    for (const g of [bare(4), graph(4), shape(4)]) expect(layoutPositions(g, "fd")).toBe(g.layoutFd);
  });

  it("3D is FD in 3D, Bespoke 3D the dataset's own", () => {
    expect(layoutPositions(bare(4), "fd3d")).not.toBeNull();
    expect(hasLayout(bare(4), "own3d")).toBe(false);
    expect(hasLayout(shape(4), "fd3d")).toBe(false);
    expect(layoutPositions(shape(4), "own3d")).not.toBeNull();
  });

  it("Bespoke 2D is there only with a 2D of the dataset's own", () => {
    expect(hasLayout(graph(4), "own2d")).toBe(true);
    expect(hasLayout(bare(4), "own2d")).toBe(false);
    expect(hasLayout(null, "fd")).toBe(false);
  });
});

describe("openingSettings", () => {
  it("opens 2D, Interactive on within the limit", () => {
    expect(openingSettings(bare(10))).toEqual({ layout: "fd", live: true });
    expect(openingSettings(graph(10))).toEqual({ layout: "fd", live: true });
  });

  it("past the Interactive limit, opens its own 3D or else 2D, Interactive off", () => {
    const big = LIVE_MAX_NODES + 1;
    expect(openingSettings(bare(big))).toEqual({ layout: "fd", live: false });
    expect(openingSettings(shape(big))).toEqual({ layout: "own3d", live: false });
  });

  it("opens the manifest's own layout with Interactive off, when the dataset has it", () => {
    expect(openingSettings(graph(10, { own3d: true, view: "3d" }))).toEqual({ layout: "own3d", live: false });
    expect(openingSettings(graph(10, { view: "2d" }))).toEqual({ layout: "own2d", live: false });
    expect(openingSettings(graph(10, { own2d: false, view: "2d" }))).toEqual({ layout: "fd", live: true });
  });
});
