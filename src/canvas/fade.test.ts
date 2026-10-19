import { describe, expect, it } from "vitest";
import { contrastShare, fade } from "./fade";

describe("Contrast's fade", () => {
  it("runs from full strength at 0% to the floor at 100%", () => {
    expect(contrastShare(0)).toBe(1);
    expect(contrastShare(50)).toBeCloseTo(0.55);
    expect(contrastShare(100)).toBeCloseTo(0.1);
  });

  it("leaves the ink alone at full strength", () => {
    expect(fade("#2f3540", "#ffffff", 1)).toBe("#2f3540");
    expect(fade("rgba(14, 18, 28, 0.28)", "#ffffff", 1)).toBe("rgba(14, 18, 28, 0.28)");
  });

  it("mixes an opaque ink toward the panel", () => {
    expect(fade("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(fade("#c4ccd9", "#10141c", 0.1)).toBe("rgb(34, 38, 47)");
    expect(fade("rgb(0, 0, 0)", "#ffffff", 0.1)).toBe("rgb(230, 230, 230)");
  });

  it("scales a translucent ink's alpha", () => {
    expect(fade("rgba(14, 18, 28, 0.28)", "#ffffff", 0.5)).toBe("rgba(14, 18, 28, 0.14)");
    expect(fade("rgba(255, 255, 255, 0.22)", "#10141c", 0.1)).toBe("rgba(255, 255, 255, 0.022)");
  });

  it("draws an unreadable colour as it is", () => {
    expect(fade("tomato", "#ffffff", 0.5)).toBe("tomato");
  });
});
