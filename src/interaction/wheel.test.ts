import { describe, expect, it } from "vitest";
import { listWheelSideways, wheelAction } from "./wheel";

const wheel = (mods: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => ({
  ctrlKey: mods.ctrlKey ?? false,
  shiftKey: mods.shiftKey ?? false,
});

describe("wheelAction", () => {
  it("navigates on a plain scroll, either axis", () => {
    expect(wheelAction(wheel())).toBe("navigate");
  });

  it("leaves Shift+wheel to the row", () => {
    expect(wheelAction(wheel({ shiftKey: true }))).toBe("row");
  });

  it("always zooms on a pinch", () => {
    expect(wheelAction(wheel({ ctrlKey: true }))).toBe("zoom");
    expect(wheelAction(wheel({ ctrlKey: true, shiftKey: true }))).toBe("zoom");
  });
});

describe("listWheelSideways", () => {
  const w = (deltaX: number, deltaY: number, ctrlKey = false) => ({ deltaX, deltaY, ctrlKey });

  it("swallows a sideways swipe, Shift+wheel's deltaX included", () => {
    expect(listWheelSideways(w(30, 0))).toBe(true);
    expect(listWheelSideways(w(-12, 3))).toBe(true);
  });

  it("leaves a vertical or mostly vertical scroll to the list", () => {
    expect(listWheelSideways(w(0, 40))).toBe(false);
    expect(listWheelSideways(w(5, -20))).toBe(false);
    expect(listWheelSideways(w(0, 0))).toBe(false);
  });

  it("leaves a pinch alone", () => {
    expect(listWheelSideways(w(30, 0, true))).toBe(false);
  });

  it("leaves a sideways swipe to the row when the row scrolls", () => {
    expect(listWheelSideways(w(30, 0), true)).toBe(false);
    expect(listWheelSideways(w(-12, 3), true)).toBe(false);
  });
});
