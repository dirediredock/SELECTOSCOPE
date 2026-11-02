import { describe, expect, it } from "vitest";
import { railOfSlide, SLIDE, SLIDE_RAIL, slideFromRail, slideText } from "./hopsPane";

describe("slide rail", () => {
  it("runs squared from 0 to the max", () => {
    expect(slideFromRail(SLIDE_RAIL.min)).toBe(0);
    expect(slideFromRail(SLIDE_RAIL.max)).toBe(SLIDE.max);
    expect(slideFromRail(SLIDE_RAIL.max / 2)).toBe(13); // 12.5, whole above 10
    expect(railOfSlide(1)).toBe(141);
  });

  it("snaps to what the readout shows, and round-trips", () => {
    expect(slideFromRail(141)).toBe(1);
    expect(slideFromRail(100)).toBe(0.5);
    for (const s of [0, 0.1, 1, 2.5, 9.9, 10, 12, 50]) expect(slideFromRail(railOfSlide(s))).toBe(s);
  });

  it("reads one decimal under 10×, whole multiples above", () => {
    expect(slideText(0)).toBe("0×");
    expect(slideText(2.5)).toBe("2.5×");
    expect(slideText(12)).toBe("12×");
    expect(slideText(50)).toBe("50×");
  });
});
