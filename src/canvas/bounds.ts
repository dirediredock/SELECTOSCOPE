// A point set's extent, in its own units. Pure, so the thumbnails
// (panes/data/thumb.ts) and tests can use it outside a pane.

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// The bounding box of the first n points of a flattened [x0, y0, x1, ...].
export function boundsOf(layout: Float32Array, n: number): Bounds {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let v = 0; v < n; v++) {
    const x = layout[2 * v]!, y = layout[2 * v + 1]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1 };
}
