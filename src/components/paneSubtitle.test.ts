import { describe, expect, it } from "vitest";
import { hopcensusSubtitle, ksnakesSubtitle, labelsSubtitle, matrixSubtitle, nodelinkSubtitle, paneSubtitle } from "./paneSubtitle";

describe("pane subtitles", () => {
  it("names the Labels sort", () => {
    expect(labelsSubtitle("degree")).toBe("Degree");
    expect(labelsSubtitle("onion")).toBe("Onion");
    expect(labelsSubtitle("alpha")).toBe("Labels (A–Z)");
  });

  it("names the NodeLink layout, and the one Interactive started from", () => {
    expect(nodelinkSubtitle({ layout: "fd", live: false })).toBe("2D");
    expect(nodelinkSubtitle({ layout: "fd3d", live: false })).toBe("3D");
    expect(nodelinkSubtitle({ layout: "own2d", live: false })).toBe("Bespoke 2D");
    expect(nodelinkSubtitle({ layout: "own3d", live: false })).toBe("Bespoke 3D");
    expect(nodelinkSubtitle({ layout: "own2d", live: true })).toBe("Interactive from Bespoke 2D");
  });

  it("names the matrix order, then its form", () => {
    expect(matrixSubtitle({ seriation: "harm1", form: "diamond" })).toBe("H1");
    expect(matrixSubtitle({ seriation: "pc2", form: "square" })).toBe("PC2, square");
  });

  it("names the Shells order, and grouped singletons", () => {
    expect(ksnakesSubtitle({ ordering: "topdown", group: false })).toBe("Barycenter");
    expect(ksnakesSubtitle({ ordering: "packed", group: true })).toBe("Size, grouped");
  });

  it("names Hops' shape order, and Ranking while it is on", () => {
    expect(hopcensusSubtitle({ measure: "spread", rank: true })).toBe("Spread similarity, ranked");
    expect(hopcensusSubtitle({ measure: "reach", rank: false })).toBe("Reach similarity");
    expect(hopcensusSubtitle({ measure: "skew", rank: false })).toBe("Skew similarity");
  });

  it("gives Data none", () => {
    expect(paneSubtitle("dataset", "s0")).toBeNull();
  });
});
