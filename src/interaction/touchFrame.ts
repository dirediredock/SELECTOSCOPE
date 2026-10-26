// The fingers on a touchscreen, as one frame: their centroid, which pans or
// turns the view, and their spread, whose ratio from move to move zooms it.
// Pure, so it is unit-tested directly (touchFrame.test.ts).

export interface TouchFrame {
  x: number;
  y: number;
  spread: number; // mean distance from the centroid
}

export function touchFrame(points: Iterable<{ x: number; y: number }>): TouchFrame {
  const pts = [...points];
  let x = 0, y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  x /= pts.length;
  y /= pts.length;
  let spread = 0;
  for (const p of pts) spread += Math.hypot(p.x - x, p.y - y);
  return { x, y, spread: spread / pts.length };
}
