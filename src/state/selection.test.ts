import { describe, expect, it } from "vitest";
import { datasetStore } from "../data/datasetStore";
import type { Graph } from "../data/graph";
import {
  applySelection,
  canShrink,
  endpointsOf,
  growSelection,
  hopCount,
  hopOut,
  merged,
  selectionStore,
  sharedEdges,
  sharePercent,
  shrinkSelection,
} from "./selection";

// A triangle 0-1-2 with a pendant 3 on node 2: edges 0-1, 1-2, 2-0, 2-3.
const source = Uint32Array.of(0, 1, 2, 2);
const target = Uint32Array.of(1, 2, 0, 3);
const shared = (nodes: number[]) => sharedEdges(source, target, new Set(nodes));

describe("sharedEdges", () => {
  it("takes the edges with both endpoints in the set", () => {
    expect(shared([0, 1, 2])).toEqual([0, 1, 2]);
  });

  it("takes nothing from non-adjacent nodes", () => {
    expect(shared([0, 3])).toEqual([]);
  });

  it("takes nothing from a single node", () => {
    expect(shared([2])).toEqual([]);
  });

  it("takes every edge from every node", () => {
    expect(shared([0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
  });
});

describe("endpointsOf", () => {
  it("takes both ends of every edge, once each", () => {
    expect([...endpointsOf(source, target, [0, 1])].sort()).toEqual([0, 1, 2]);
  });

  it("takes nothing from no edges", () => {
    expect([...endpointsOf(source, target, [])]).toEqual([]);
  });
});

describe("merged", () => {
  const cur = new Set([1, 2]);
  const sorted = (s: ReadonlySet<number>) => [...s].sort();

  it("replaces", () => {
    expect(sorted(merged(cur, "replace", [3]))).toEqual([3]);
  });

  it("adds", () => {
    expect(sorted(merged(cur, "add", [2, 3]))).toEqual([1, 2, 3]);
  });

  it("subtracts", () => {
    expect(sorted(merged(cur, "subtract", [2, 3]))).toEqual([1]);
  });

  it("keeps the set when adding or subtracting nothing", () => {
    expect(sorted(merged(cur, "add", []))).toEqual([1, 2]);
    expect(sorted(merged(cur, "subtract", []))).toEqual([1, 2]);
  });

  it("clears the set when replacing with nothing", () => {
    expect(sorted(merged(cur, "replace", []))).toEqual([]);
  });

  it("never changes the set it was given", () => {
    merged(cur, "add", [9]);
    expect(sorted(cur)).toEqual([1, 2]);
  });
});

describe("hopOut", () => {
  const out = (seeds: number[]) => hopOut(source, target, new Set(seeds));
  const sorted = (s: Iterable<number>) => [...s].sort();

  it("walks a pendant's one edge to its neighbour", () => {
    expect(out([3]).edges).toEqual([3]);
    expect(sorted(out([3]).nodes)).toEqual([2, 3]);
  });

  it("walks every edge a hub touches", () => {
    expect(out([2]).edges).toEqual([1, 2, 3]);
    expect(sorted(out([2]).nodes)).toEqual([0, 1, 2, 3]);
  });

  it("walks nothing from no seeds", () => {
    expect(out([]).edges).toEqual([]);
    expect(sorted(out([]).nodes)).toEqual([]);
  });
});

describe("Grow and Shrink", () => {
  const nodes = () => [...selectionStore.get().nodes].sort();
  const edges = () => [...selectionStore.get().edges].sort();
  // A new graph empties both sets, so every test starts from nothing.
  const load = () => datasetStore.set({ graph: { edgeSource: source, edgeTarget: target } as unknown as Graph });

  it("steps back through the Grows, even from the whole graph", () => {
    load();
    applySelection("node", "replace", [3]);
    growSelection("both");
    growSelection("both");
    expect(nodes()).toEqual([0, 1, 2, 3]);
    expect(canShrink(selectionStore.get())).toBe(true);
    shrinkSelection();
    expect(nodes()).toEqual([2, 3]);
    expect(edges()).toEqual([3]);
    shrinkSelection();
    expect(nodes()).toEqual([3]);
    expect(edges()).toEqual([]);
  });

  it("stops at the selection the Grows started from", () => {
    load();
    applySelection("node", "replace", [2, 3]);
    growSelection("node");
    shrinkSelection();
    expect(nodes()).toEqual([2, 3]);
    expect(canShrink(selectionStore.get())).toBe(false);
    shrinkSelection();
    expect(nodes()).toEqual([2, 3]);
    // Growing again from the origin, and back, still stops there.
    growSelection("node");
    shrinkSelection();
    shrinkSelection();
    expect(nodes()).toEqual([2, 3]);
  });

  it("forgets the Grows once another change makes a new start", () => {
    load();
    applySelection("node", "replace", [3]);
    growSelection("node");
    applySelection("node", "add", [1]);
    expect(canShrink(selectionStore.get())).toBe(false);
    shrinkSelection();
    expect(nodes()).toEqual([1, 2, 3]);
  });

  it("never shrinks a selection no Grow made", () => {
    load();
    applySelection("node", "replace", [1, 2, 3]);
    expect(canShrink(selectionStore.get())).toBe(false);
    shrinkSelection();
    expect(nodes()).toEqual([1, 2, 3]);
  });

  it("counts the Grows the sets stand from their origin", () => {
    load();
    applySelection("node", "replace", [3]);
    expect(hopCount(selectionStore.get())).toBe(0);
    growSelection("node");
    growSelection("node");
    expect(hopCount(selectionStore.get())).toBe(2);
    shrinkSelection();
    expect(hopCount(selectionStore.get())).toBe(1);
    applySelection("node", "add", [0]);
    expect(hopCount(selectionStore.get())).toBe(0);
  });

  it("steps back exactly whatever the mode is now", () => {
    load();
    applySelection("node", "replace", [3]);
    const start = selectionStore.get();
    growSelection("node");
    growSelection("edge");
    expect(edges()).toEqual([1, 2, 3]);
    shrinkSelection();
    shrinkSelection();
    expect(selectionStore.get().nodes).toBe(start.nodes);
    expect(selectionStore.get().edges).toBe(start.edges);
  });
});

describe("set share", () => {
  it("reads 0% only for an empty set", () => {
    expect(sharePercent(0, 484)).toBe("0%");
    expect(sharePercent(0, null)).toBe("0%");
    expect(sharePercent(1, 484)).toBe("<1%");
  });

  it("rounds from 1% up", () => {
    expect(sharePercent(5, 484)).toBe("1%");
    expect(sharePercent(242, 484)).toBe("50%");
    expect(sharePercent(484, 484)).toBe("100%");
  });
});
