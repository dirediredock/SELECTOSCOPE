import { boundsOf } from "./bounds";
import type { Bounds } from "./bounds";
import { IDENTITY } from "../state/views";
import type { Transform } from "../state/views";

export { boundsOf };
export type { Bounds };

// Px kept clear on each side of the pane when fitting.
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Layout units (y up) -> pane screen positions (CSS px, y down): first fitted
// to the pane, then the pane's zoom/pan about its centre (state/views.ts).
// Hit-testing reads `pos`, so selection always matches what is drawn. Shared
// by every pane that draws items as points.

export class PointView {
  pos = new Float32Array(0);
  n = 0;
  private fitted = new Float32Array(0);
  // The fit: fitted = (fx + x * s, fy - y * s).
  private s = 1;
  private fx = 0;
  private fy = 0;
  // The pane centre the zoom is about, and the current zoom/pan.
  private cx = 0;
  private cy = 0;
  private t: Transform = IDENTITY;

  // Fit `bounds` (by default the points' own extent) into the w x h pane,
  // `pad` px from its edges (one for every side, or each its own), and centre
  // it in what is left. By "height", only the height fits: a wide extent runs
  // past the pane's sides. A number between 0 and 1 blends the two scales,
  // "both" at 0 and "height" at 1, for a fit that moves between them. By
  // "none", nothing is scaled: the layout is already in px at 100% zoom, and is
  // only centred. The zoom still turns about the pane's centre.
  fit(
    layout: Float32Array,
    n: number,
    w: number,
    h: number,
    pad: number | Insets = 20,
    bounds = boundsOf(layout, n),
    by: "both" | "height" | "none" | number = "both",
  ) {
    const { x0, x1, y0, y1 } = bounds;
    const { left, right, top, bottom } =
      typeof pad === "number" ? { left: pad, right: pad, top: pad, bottom: pad } : pad;
    const sh = (h - top - bottom) / (y1 - y0 || 1);
    const sBoth = Math.min((w - left - right) / (x1 - x0 || 1), sh);
    const blend = by === "height" ? 1 : typeof by === "number" ? by : 0;
    const s = by === "none" ? 1 : sBoth + (sh - sBoth) * blend;
    this.s = s;
    this.fx = (left + w - right) / 2 - ((x0 + x1) / 2) * s;
    this.fy = (top + h - bottom) / 2 + ((y0 + y1) / 2) * s;
    this.cx = w / 2;
    this.cy = h / 2;
    if (this.fitted.length !== 2 * n) {
      this.fitted = new Float32Array(2 * n);
      this.pos = new Float32Array(2 * n);
    }
    for (let v = 0; v < n; v++) {
      this.fitted[2 * v] = this.fx + layout[2 * v]! * s;
      this.fitted[2 * v + 1] = this.fy - layout[2 * v + 1]! * s;
    }
    this.n = n;
  }

  apply(t: Transform) {
    this.t = t;
    const f = this.fitted, p = this.pos;
    const ox = this.cx * (1 - t.k) + t.tx, oy = this.cy * (1 - t.k) + t.ty;
    for (let i = 0; i < 2 * this.n; i += 2) {
      p[i] = f[i]! * t.k + ox;
      p[i + 1] = f[i + 1]! * t.k + oy;
    }
  }

  // Any layout point (an outline corner, a gridline end) to the screen.
  project(x: number, y: number): [number, number] {
    const { k, tx, ty } = this.t;
    return [
      (this.fx + x * this.s) * k + this.cx * (1 - k) + tx,
      (this.fy - y * this.s) * k + this.cy * (1 - k) + ty,
    ];
  }

  // A screen position back to layout units: the inverse of project().
  unproject(sx: number, sy: number): [number, number] {
    const { k, tx, ty } = this.t;
    const fx = (sx - this.cx * (1 - k) - tx) / k;
    const fy = (sy - this.cy * (1 - k) - ty) / k;
    return [(fx - this.fx) / this.s, (this.fy - fy) / this.s];
  }

  // Screen px per layout unit at the current zoom.
  get pxPerUnit(): number {
    return this.s * this.t.k;
  }
}
