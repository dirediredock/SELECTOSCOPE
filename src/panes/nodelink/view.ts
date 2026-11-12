import { nodeVoiced } from "../../state/sweepRun";
import type { SweepAxis } from "../../state/sweepRun";

// Mark size shrinks as graphs grow, within legible bounds. Marks keep their
// screen size under zoom, so zooming in separates crowded nodes.
export const nodeRadius = (n: number) => Math.max(1.5, Math.min(4, 40 / Math.sqrt(Math.max(n, 1))));

// The sweep's axis: top to bottom (layout y is up), or sideways left to
// right. In 3D it spans the unit sphere, so turning never changes its extent;
// in 2D and Interactive the positions' extent.
export function sweepAxis(xy: Float32Array, is3d: boolean, n: number, sideways = false): SweepAxis {
  // The nodes' places along one screen direction, in [0, 1].
  const places = (at: (v: number) => number) => {
    const out = new Float64Array(n);
    if (is3d) {
      for (let v = 0; v < n; v++) out[v] = (1 + at(v)) / 2;
      return out;
    }
    let lo = Infinity, hi = -Infinity;
    for (let v = 0; v < n; v++) {
      const p = at(v);
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    }
    const span = hi - lo || 1;
    for (let v = 0; v < n; v++) out[v] = (at(v) - lo) / span;
    return out;
  };
  // Along the axis, increasing in the band's direction; the voice's pitch
  // rises across it, left to right or bottom to top.
  const right = places((v) => xy[2 * v]!);
  if (sideways) return nodeVoiced(right, places((v) => xy[2 * v + 1]!));
  return nodeVoiced(places((v) => -xy[2 * v + 1]!), right);
}
