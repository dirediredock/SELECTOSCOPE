import type { SweepAxis } from "../../state/sweep";

// Mark size shrinks as graphs grow, within legible bounds. Marks keep their
// screen size under zoom, so zooming in separates crowded nodes.
export const nodeRadius = (n: number) => Math.max(1.5, Math.min(4, 40 / Math.sqrt(Math.max(n, 1))));

// The sweep's axis: top to bottom (layout y is up), or sideways left to
// right. In 3D it spans the unit sphere, so turning never changes its extent;
// in 2D and Interactive the positions' extent.
export function sweepAxis(xy: Float32Array, is3d: boolean, n: number, sideways = false): SweepAxis {
  const nodes = new Float64Array(n);
  // Along the axis, increasing in the band's direction.
  const at = sideways ? (v: number) => xy[2 * v]! : (v: number) => -xy[2 * v + 1]!;
  if (is3d) {
    for (let v = 0; v < n; v++) nodes[v] = (1 + at(v)) / 2;
    return { nodes };
  }
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < n; v++) {
    const p = at(v);
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  const span = hi - lo || 1;
  for (let v = 0; v < n; v++) nodes[v] = (at(v) - lo) / span;
  return { nodes };
}
