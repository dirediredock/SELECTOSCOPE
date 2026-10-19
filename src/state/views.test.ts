import { describe, expect, it } from "vitest";
import { homeOf, IDENTITY, zoomAt } from "./views";
import type { Transform } from "./views";

// screen = c + (fitted - c) * k + t, written relative to the centre c.
const screen = (t: Transform, q: number) => q * t.k + t.tx;

describe("homeOf", () => {
  it("opens NodeLink at 85%, centred", () => {
    expect(homeOf("nodelink")).toEqual({ k: 0.85, tx: 0, ty: 0 });
  });

  it("opens other panes fitted", () => {
    expect(homeOf("matrix")).toEqual(IDENTITY);
  });
});

describe("zoomAt", () => {
  it("keeps the point under the cursor fixed", () => {
    const t: Transform = { k: 0.85, tx: 12, ty: -4 };
    const cursor = 37; // px right of the pane centre
    const q = (cursor - t.tx) / t.k; // the fitted point under it
    const z = zoomAt(t, 2, cursor, 0);
    expect(z.k).toBeCloseTo(1.7);
    expect(screen(z, q)).toBeCloseTo(cursor);
  });

  it("zooms about the centre when the cursor is there", () => {
    const z = zoomAt(homeOf("nodelink"), 1.5, 0, 0);
    expect(z.tx).toBeCloseTo(0);
    expect(z.ty).toBeCloseTo(0);
  });

  it("clamps the zoom", () => {
    expect(zoomAt(IDENTITY, 1000, 0, 0).k).toBe(64);
    expect(zoomAt(IDENTITY, 0.001, 0, 0).k).toBe(0.25);
  });

  it("zooms on from a fit below the minimum without jumping", () => {
    const fitted = { k: 0.1, tx: 0, ty: 0 };
    expect(zoomAt(fitted, 0.5, 0, 0).k).toBe(0.1);
    expect(zoomAt(fitted, 1.5, 0, 0).k).toBeCloseTo(0.15, 10);
  });
});
