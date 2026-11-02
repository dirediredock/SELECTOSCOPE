import { describe, expect, it } from "vitest";
import { fitAll } from "./fitAll";

describe("fitAll", () => {
  it("zooms out only when the pattern is too tall", () => {
    expect(fitAll(1000, 500)).toEqual({ k: 0.5, tx: 0, ty: 0 });
    expect(fitAll(200, 500)).toEqual({ k: 1, tx: 0, ty: 0 });
  });

  it("zooms out to fit a pattern wider than the pane", () => {
    expect(fitAll(200, 500, 800, 400)).toEqual({ k: 0.5, tx: 0, ty: 0 });
    expect(fitAll(1000, 500, 800, 400)).toEqual({ k: 0.5, tx: 0, ty: 0 });
  });
});
