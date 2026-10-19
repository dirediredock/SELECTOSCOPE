import { describe, expect, it } from "vitest";
import type { Graph } from "../../data/graph";
import { ANCHOR_HOLD_MS, anchorHold, startLive } from "./live";

describe("anchorHold", () => {
  it("pins at the drop and lets go over the hold", () => {
    expect(anchorHold(0)).toBe(1);
    expect(anchorHold(ANCHOR_HOLD_MS)).toBe(0);
    expect(anchorHold(2 * ANCHOR_HOLD_MS)).toBe(0);
  });

  it("loosens steadily", () => {
    let prev = 1;
    for (let t = 1; t <= 10; t++) {
      const w = anchorHold((t * ANCHOR_HOLD_MS) / 10);
      expect(w).toBeLessThan(prev);
      prev = w;
    }
  });
});

// A path 0-1-2-3, laid out along x: only the fields the simulation reads.
const path = {
  n: 4,
  m: 3,
  edgeSource: Uint32Array.from([0, 1, 2]),
  edgeTarget: Uint32Array.from([1, 2, 3]),
  layoutFd: Float32Array.from([0, 0, 0.1, 0, 0.2, 0, 0.3, 0]),
} as Graph;

describe("group drag", () => {
  it("moves every member by the held node's offset", () => {
    const sim = startLive(path, path.layoutFd!, () => {});
    sim.stop();
    const before = Array.from(sim.xy);
    sim.grab(1, [3, 1, 3]);
    sim.dragTo(before[2]! + 0.05, before[3]! - 0.02);
    sim.stop();
    for (const v of [1, 3]) {
      expect(sim.xy[2 * v]).toBeCloseTo(before[2 * v]! + 0.05, 5);
      expect(sim.xy[2 * v + 1]).toBeCloseTo(before[2 * v + 1]! - 0.02, 5);
    }
    for (const v of [0, 2]) {
      expect(sim.xy[2 * v]).toBe(before[2 * v]);
      expect(sim.xy[2 * v + 1]).toBe(before[2 * v + 1]);
    }
    sim.release();
    sim.stop();
  });
});
