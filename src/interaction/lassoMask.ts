// What a lasso encloses. A freehand lasso often crosses itself: it overshoots
// its start, or loops twice. A winding rule then leaves holes, where it
// circles a region twice (even-odd) or once each way (nonzero). Here a point
// is inside unless it can reach the outside without crossing the outline:
// the outline is drawn into a grid of pixel cells and the outside is
// flood-filled in from the border, so every loop counts. The drawn fill and
// the hit-test both read this mask, so the shape shows what it will take.

// Past this many cells, cells grow, so a huge lasso stays cheap.
const MAX_CELLS = 4_000_000;

const WALL = 1;
export const OUTSIDE = 2;

export interface LassoMask {
  x0: number; // pane px of the grid's top-left corner
  y0: number;
  w: number; // in cells
  h: number;
  scale: number; // px per cell
  cells: Uint8Array; // OUTSIDE where not enclosed; the outline counts as inside
  contains(x: number, y: number): boolean;
}

export function lassoMask(poly: number[]): LassoMask {
  const k = poly.length >> 1;
  if (k < 3) return { x0: 0, y0: 0, w: 0, h: 0, scale: 1, cells: new Uint8Array(0), contains: () => false };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < 2 * k; i += 2) {
    minX = Math.min(minX, poly[i]!);
    maxX = Math.max(maxX, poly[i]!);
    minY = Math.min(minY, poly[i + 1]!);
    maxY = Math.max(maxY, poly[i + 1]!);
  }
  const area = (maxX - minX + 3) * (maxY - minY + 3);
  const scale = area > MAX_CELLS ? Math.ceil(Math.sqrt(area / MAX_CELLS)) : 1;
  // One cell of padding on every side, so the whole border is outside.
  const x0 = (Math.floor(minX / scale) - 1) * scale;
  const y0 = (Math.floor(minY / scale) - 1) * scale;
  const w = Math.floor((maxX - x0) / scale) + 2;
  const h = Math.floor((maxY - y0) / scale) + 2;
  const cells = new Uint8Array(w * h);

  // Every cell a segment passes through (Amanatides–Woo), so the outline is
  // 4-connected and the flood can't slip through it diagonally.
  const wall = (ax: number, ay: number, bx: number, by: number) => {
    let cx = Math.floor(ax), cy = Math.floor(ay);
    const ex = Math.floor(bx), ey = Math.floor(by);
    const dx = bx - ax, dy = by - ay;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx ? Math.abs(1 / dx) : Infinity;
    const tdy = dy ? Math.abs(1 / dy) : Infinity;
    let tx = dx > 0 ? (cx + 1 - ax) * tdx : dx < 0 ? (ax - cx) * tdx : Infinity;
    let ty = dy > 0 ? (cy + 1 - ay) * tdy : dy < 0 ? (ay - cy) * tdy : Infinity;
    cells[cy * w + cx] = WALL;
    while (cx !== ex || cy !== ey) {
      // Each step lands on the end cell even where rounding blurs a corner.
      if (cy === ey || (cx !== ex && tx < ty)) {
        cx += sx;
        tx += tdx;
      } else {
        cy += sy;
        ty += tdy;
      }
      cells[cy * w + cx] = WALL;
    }
  };
  for (let i = 0, j = k - 1; i < k; j = i++) {
    wall(
      (poly[2 * j]! - x0) / scale,
      (poly[2 * j + 1]! - y0) / scale,
      (poly[2 * i]! - x0) / scale,
      (poly[2 * i + 1]! - y0) / scale,
    );
  }

  // Flood the outside in from the border, 4-connected.
  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (c: number) => {
    if (cells[c] === 0) {
      cells[c] = OUTSIDE;
      stack[top++] = c;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (top > 0) {
    const c = stack[--top]!;
    const x = c % w;
    if (x > 0) push(c - 1);
    if (x < w - 1) push(c + 1);
    if (c >= w) push(c - w);
    if (c < (h - 1) * w) push(c + w);
  }

  return {
    x0,
    y0,
    w,
    h,
    scale,
    cells,
    contains(x, y) {
      const cx = Math.floor((x - x0) / scale), cy = Math.floor((y - y0) / scale);
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) return false;
      return cells[cy * w + cx] !== OUTSIDE;
    },
  };
}
