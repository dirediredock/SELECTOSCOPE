import { describe, expect, it } from "vitest";
import { PointView } from "./pointView";

describe("PointView.unproject", () => {
  it("inverts project under zoom and pan", () => {
    const view = new PointView();
    view.fit(Float32Array.of(-3, 1, 5, 4, 0, -2), 3, 400, 300, 20);
    view.apply({ k: 2.5, tx: 17, ty: -40 });
    for (const [x, y] of [[0, 0], [-3, 1], [2.25, -7.5]] as const) {
      const [sx, sy] = view.project(x, y);
      const [bx, by] = view.unproject(sx, sy);
      expect(bx).toBeCloseTo(x, 5);
      expect(by).toBeCloseTo(y, 5);
    }
  });
});

describe("PointView.fit", () => {
  const box = Float32Array.of(0, 0, 2, 2);

  it("fits the tighter axis by default", () => {
    const view = new PointView();
    view.fit(box, 2, 100, 200, 10);
    view.apply({ k: 1, tx: 0, ty: 0 });
    expect(view.pxPerUnit).toBeCloseTo(40, 5);
  });

  it("fits and centres within each side's own pad", () => {
    const view = new PointView();
    view.fit(box, 2, 100, 200, { left: 10, right: 50, top: 20, bottom: 0 });
    view.apply({ k: 1, tx: 0, ty: 0 });
    expect(view.pxPerUnit).toBeCloseTo(20, 5);
    // Centred in x 10..50 and y 20..200.
    expect(view.project(1, 1)).toEqual([30, 110]);
  });

  it("fits only the height by 'height', centred", () => {
    const view = new PointView();
    view.fit(box, 2, 100, 200, 10, undefined, "height");
    view.apply({ k: 1, tx: 0, ty: 0 });
    expect(view.pxPerUnit).toBeCloseTo(90, 5);
    expect(view.project(1, 1)).toEqual([50, 100]);
  });

  it("keeps px by 'none', centred", () => {
    const view = new PointView();
    view.fit(box, 2, 100, 200, 10, undefined, "none");
    view.apply({ k: 1, tx: 0, ty: 0 });
    expect(view.pxPerUnit).toBe(1);
    expect(view.project(1, 1)).toEqual([50, 100]);
    expect(view.project(2, 2)).toEqual([51, 99]);
  });
});
