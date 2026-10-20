import { describe, expect, it } from "vitest";
import { rowModeFor } from "./rowMode";

describe("rowModeFor", () => {
  it("fits a landscape window and scrolls a portrait one", () => {
    expect(rowModeFor(null, 1400, 900)).toBe("fit");
    expect(rowModeFor(null, 900, 1400)).toBe("scroll");
    expect(rowModeFor("scroll", 1400, 900)).toBe("fit");
    expect(rowModeFor("fit", 900, 1400)).toBe("scroll");
  });

  it("keeps the current mode inside the band", () => {
    expect(rowModeFor("fit", 1000, 1000)).toBe("fit");
    expect(rowModeFor("scroll", 1000, 1000)).toBe("scroll");
    expect(rowModeFor("fit", 960, 1000)).toBe("fit");
    expect(rowModeFor("scroll", 1040, 1000)).toBe("scroll");
  });

  it("switches only past the band's edges", () => {
    expect(rowModeFor("fit", 950, 1000)).toBe("fit");
    expect(rowModeFor("fit", 949, 1000)).toBe("scroll");
    expect(rowModeFor("scroll", 1050, 1000)).toBe("scroll");
    expect(rowModeFor("scroll", 1051, 1000)).toBe("fit");
  });

  it("opens in Fit inside the band", () => {
    expect(rowModeFor(null, 1000, 1000)).toBe("fit");
    expect(rowModeFor(null, 960, 1000)).toBe("fit");
  });
});
