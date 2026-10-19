import { describe, expect, it } from "vitest";
import { polylineHitTester, segmentInRect, segmentsCross } from "./hits";

// Line 0: a V from (0, 0) down to (10, 10) and up to (20, 0).
// Line 1: flat at y = 30 from (0, 30) to (20, 30).
// Line 2: the same as line 1, drawn on top of it.
const pos = Float32Array.of(0, 0, 10, 10, 20, 0, 0, 30, 20, 30, 0, 30, 20, 30);
const offset = Uint32Array.of(0, 3, 5, 7);
const hit = polylineHitTester(
  () => pos,
  () => offset,
);

describe("segment tests", () => {
  it("clips a segment against a rectangle", () => {
    expect(segmentInRect(-5, 5, 15, 5, 0, 0, 10, 10)).toBe(true); // passes through
    expect(segmentInRect(-5, -5, -1, 20, 0, 0, 10, 10)).toBe(false);
    expect(segmentInRect(2, 2, 3, 3, 0, 0, 10, 10)).toBe(true); // inside
  });

  it("finds crossings, touching included", () => {
    expect(segmentsCross(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(segmentsCross(0, 0, 10, 0, 0, 1, 10, 1)).toBe(false);
    expect(segmentsCross(0, 0, 10, 0, 10, 0, 20, 0)).toBe(true);
  });
});

describe("polylineHitTester", () => {
  it("takes the nearest line in reach, the one on top on a tie", () => {
    expect(hit.itemAt(5, 6)).toBe(0);
    expect(hit.itemAt(10, 31)).toBe(2);
    expect(hit.itemAt(10, 20)).toBeNull();
  });

  it("takes a line when any part of it is in the rectangle", () => {
    // Between the V's vertices, on its lower segments only.
    expect(hit.itemsInRect(8, 6, 12, 9)).toEqual([0]);
    expect(hit.itemsInRect(5, 25, 6, 35)).toEqual([1, 2]);
    expect(hit.itemsInRect(8, 15, 12, 20)).toEqual([]);
  });

  it("takes a line whose segment crosses the lasso, with no vertex inside", () => {
    // A small triangle across the V's right arm, clear of every vertex.
    expect(hit.itemsInPolygon([14, 2, 18, 2, 16, 8])).toEqual([0]);
    expect(hit.itemsInPolygon([2, 12, 8, 12, 5, 18])).toEqual([]);
  });
});
