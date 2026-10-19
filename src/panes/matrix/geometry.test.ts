import { describe, expect, it } from "vitest";
import { edgePoints, nodeLines, outline, posed, POSE, poseAt, rowsOf, formBounds, toLayout } from "./geometry";

describe("toLayout", () => {
  it("draws the square with row 0 at the top", () => {
    expect(toLayout(POSE.square, 2, 5)).toEqual([5, -2]);
  });

  it("stands the diamond on a corner: height is row + col", () => {
    expect(toLayout(POSE.diamond, 0, 0)).toEqual([0, -0]);
    expect(toLayout(POSE.diamond, 2, 5)).toEqual([3, -7]);
    // The mirror copy is its reflection across the vertical centre line.
    expect(toLayout(POSE.diamond, 5, 2)).toEqual([-3, -7]);
  });
});

describe("poses", () => {
  it("turn the square's layout into the diamond's", () => {
    const square = Float32Array.from(toLayout(POSE.square, 2, 5));
    expect(Array.from(posed(new Float32Array(2), square, POSE.diamond))).toEqual(toLayout(POSE.diamond, 2, 5));
  });

  it("end the turn on the diamond", () => {
    expect(poseAt(0)).toBe(POSE.square);
    expect(poseAt(1)).toBe(POSE.diamond);
  });
});

describe("edgePoints", () => {
  // Nodes 0, 1, 2 at rows 2, 0, 1; edges 0-1 and 1-2.
  const row = rowsOf(Uint32Array.of(1, 2, 0));
  const source = Uint32Array.of(0, 1), target = Uint32Array.of(1, 2);

  it("maps each node to its row", () => {
    expect(Array.from(row)).toEqual([2, 0, 1]);
  });

  it("draws every edge twice, mirrored", () => {
    const p = edgePoints(row, source, target);
    expect(p.count).toBe(4);
    expect(Array.from(p.edgeOf)).toEqual([0, 1, 0, 1]);
    // Edge 0 joins rows 2 and 0: cells (0.5, 2.5) and (2.5, 0.5).
    expect(Array.from(p.layout.slice(0, 2))).toEqual([2.5, -0.5]);
    expect(Array.from(p.layout.slice(4, 6))).toEqual([0.5, -2.5]);
  });
});

describe("form extents", () => {
  it("contain every outline corner", () => {
    for (const pose of [POSE.square, poseAt(0.3), POSE.diamond]) {
      const b = formBounds(pose, 10);
      const o = outline(pose, 10);
      for (let i = 0; i < o.length; i += 2) {
        expect(o[i]).toBeGreaterThanOrEqual(b.x0);
        expect(o[i]).toBeLessThanOrEqual(b.x1);
        expect(o[i + 1]).toBeGreaterThanOrEqual(b.y0);
        expect(o[i + 1]).toBeLessThanOrEqual(b.y1);
      }
    }
  });
});

describe("nodeLines", () => {
  it("pass through the node's edge points", () => {
    // Node at row 2 with an edge to row 6: its cell centre lies on its row line.
    const [x0, y0, x1, y1] = nodeLines(POSE.diamond, 10, 2);
    const [px, py] = toLayout(POSE.diamond, 2.5, 6.5);
    const cross = (x1! - x0!) * (py - y0!) - (y1! - y0!) * (px - x0!);
    expect(cross).toBeCloseTo(0);
  });
});
