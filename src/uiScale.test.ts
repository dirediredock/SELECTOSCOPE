import { describe, expect, it } from "vitest";
import { UI_SCALE, scaled } from "./uiScale";

describe("scaled", () => {
  it("draws design px at the UI scale", () => {
    expect(scaled(10)).toBeCloseTo(10 * UI_SCALE);
  });
});
