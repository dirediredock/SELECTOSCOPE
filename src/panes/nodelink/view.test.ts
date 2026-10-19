import { describe, expect, it } from "vitest";
import { sweepAxis } from "./view";

describe("sweepAxis", () => {
  // Two nodes near the middle, one above the other (layout y is up).
  const xy = Float32Array.of(0, 0.5, 0, -0.5);

  it("runs top to bottom across the unit sphere in 3D", () => {
    expect(Array.from(sweepAxis(xy, true, 2).nodes!)).toEqual([0.25, 0.75]);
  });

  it("runs top to bottom across the positions in 2D", () => {
    expect(Array.from(sweepAxis(xy, false, 2).nodes!)).toEqual([0, 1]);
  });

  // Two nodes side by side, the first on the left.
  const row = Float32Array.of(-0.5, 0, 0.5, 0);

  it("runs left to right sideways, across the unit sphere in 3D", () => {
    expect(Array.from(sweepAxis(row, true, 2, true).nodes!)).toEqual([0.25, 0.75]);
  });

  it("runs left to right sideways, across the positions in 2D", () => {
    expect(Array.from(sweepAxis(row, false, 2, true).nodes!)).toEqual([0, 1]);
  });
});
