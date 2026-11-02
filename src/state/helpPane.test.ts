import { describe, expect, it } from "vitest";
import { helpPaneStore, goToSection, sectionAt, topTarget } from "./helpPane";

// Five sections, the last short; the view is 300 high over 1200 of content.
const TOPS = [0, 250, 500, 800, 1050];
const at = (scrollTop: number) => sectionAt(TOPS, scrollTop, 300, 1200);

describe("Sections' scroll-spy", () => {
  it("picks the first section at the very top", () => {
    expect(at(0)).toBe(0);
  });

  it("picks the last section whose top has reached the view's top", () => {
    expect(at(245)).toBe(0);
    expect(at(250)).toBe(1);
    expect(at(600)).toBe(2);
    expect(at(800)).toBe(3);
  });

  it("picks the last section at the very end, though its top never reaches the top", () => {
    expect(at(900)).toBe(4);
  });

  it("counts a sheet that fits as at its top", () => {
    expect(sectionAt([0, 100], 0, 300, 300)).toBe(0);
    expect(sectionAt([], 0, 300, 300)).toBe(0);
  });
});

describe("Sections' glide target", () => {
  it("puts the section's top at the view's top", () => {
    expect(topTarget(500, 300, 1200)).toBe(500);
  });

  it("stops at the ends of the scroll", () => {
    expect(topTarget(-10, 300, 1200)).toBe(0);
    expect(topTarget(1050, 300, 1200)).toBe(900);
  });

  it("leaves a section it glides to as the one the spy shows", () => {
    expect(at(topTarget(TOPS[2]!, 300, 1200))).toBe(2);
  });
});

describe("Sections' pick", () => {
  it("shows the pick and asks for a fresh glide each time", () => {
    goToSection("sweep");
    const first = helpPaneStore.get().goto;
    expect(helpPaneStore.get().section).toBe("sweep");
    goToSection("sweep");
    expect(helpPaneStore.get().goto).not.toBe(first);
  });
});
