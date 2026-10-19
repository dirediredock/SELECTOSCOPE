import { describe, expect, it } from "vitest";
import { wheelAction } from "./wheel";

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
