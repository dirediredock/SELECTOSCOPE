import { lassoMask } from "../../interaction/lassoMask";
import type { HitTester } from "../../interaction/pointHits";

// Hit-testing over items drawn as polylines: item v runs through the screen
// positions pos[2i], pos[2i + 1] for i in offset[v] .. offset[v + 1]. A shape
// takes a line when any part of it is inside; hover and click take the
// nearest line in reach, the one drawn on top (the later item) on a tie.

const REACH = 4; // px from a line that still reaches it

// The squared distance from (x, y) to the segment a-b.
function segmentDist2(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  const ex = ax + t * dx - x, ey = ay + t * dy - y;
  return ex * ex + ey * ey;
}

// Liang-Barsky: whether any part of a-b lies in the rectangle.
export function segmentInRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay);
}

const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
  Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));

// Whether segments a-b and c-d cross (touching counts).
export function segmentsCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  // Collinear: overlapping bounding boxes.
  if (o1 || o2 || o3 || o4) return false;
  return (
    Math.max(ax, bx) >= Math.min(cx, dx) &&
    Math.max(cx, dx) >= Math.min(ax, bx) &&
    Math.max(ay, by) >= Math.min(cy, dy) &&
    Math.max(cy, dy) >= Math.min(ay, by)
  );
}

export function polylineHitTester(pos: () => Float32Array, offset: () => Uint32Array): HitTester {
  // Lines whose bounding box meets [x0, x1] x [y0, y1], each tested by `hits`.
  const within = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    hits: (p: Float32Array, first: number, last: number) => boolean,
  ) => {
    const p = pos(), off = offset();
    const out: number[] = [];
    for (let v = 0; v + 1 < off.length; v++) {
      const first = off[v]!, last = off[v + 1]! - 1;
      let lx0 = Infinity, ly0 = Infinity, lx1 = -Infinity, ly1 = -Infinity;
      for (let i = first; i <= last; i++) {
        const x = p[2 * i]!, y = p[2 * i + 1]!;
        if (x < lx0) lx0 = x;
        if (x > lx1) lx1 = x;
        if (y < ly0) ly0 = y;
        if (y > ly1) ly1 = y;
      }
      if (lx1 < x0 || lx0 > x1 || ly1 < y0 || ly0 > y1) continue;
      if (hits(p, first, last)) out.push(v);
    }
    return out;
  };

  return {
    itemAt(x, y) {
      const p = pos(), off = offset();
      let best: number | null = null;
      let bestD = REACH * REACH;
      for (let v = 0; v + 1 < off.length; v++) {
        const first = off[v]!, last = off[v + 1]! - 1;
        for (let i = first; i <= Math.max(first, last - 1); i++) {
          const j = Math.min(i + 1, last);
          const ax = p[2 * i]!, ay = p[2 * i + 1]!, bx = p[2 * j]!, by = p[2 * j + 1]!;
          if (Math.min(ax, bx) - REACH > x || Math.max(ax, bx) + REACH < x) continue;
          if (Math.min(ay, by) - REACH > y || Math.max(ay, by) + REACH < y) continue;
          const d = segmentDist2(x, y, ax, ay, bx, by);
          if (d <= bestD) {
            bestD = d;
            best = v;
          }
        }
      }
      return best;
    },

    itemsInRect(ax, ay, bx, by) {
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
      const y0 = Math.min(ay, by), y1 = Math.max(ay, by);
      return within(x0, y0, x1, y1, (p, first, last) => {
        for (let i = first; i <= Math.max(first, last - 1); i++) {
          const j = Math.min(i + 1, last);
          if (segmentInRect(p[2 * i]!, p[2 * i + 1]!, p[2 * j]!, p[2 * j + 1]!, x0, y0, x1, y1)) return true;
        }
        return false;
      });
    },

    itemsInPolygon(poly) {
      if (poly.length < 6) return [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < poly.length; i += 2) {
        x0 = Math.min(x0, poly[i]!);
        x1 = Math.max(x1, poly[i]!);
        y0 = Math.min(y0, poly[i + 1]!);
        y1 = Math.max(y1, poly[i + 1]!);
      }
      const k = poly.length / 2;
      const mask = lassoMask(poly);
      return within(x0, y0, x1, y1, (p, first, last) => {
        // A vertex inside, or a segment crossing the outline.
        for (let i = first; i <= last; i++) if (mask.contains(p[2 * i]!, p[2 * i + 1]!)) return true;
        for (let i = first; i < last; i++) {
          const ax = p[2 * i]!, ay = p[2 * i + 1]!, bx = p[2 * i + 2]!, by = p[2 * i + 3]!;
          if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1) {
            continue;
          }
          for (let e = 0, f = k - 1; e < k; f = e++) {
            if (segmentsCross(ax, ay, bx, by, poly[2 * f]!, poly[2 * f + 1]!, poly[2 * e]!, poly[2 * e + 1]!)) {
              return true;
            }
          }
        }
        return false;
      });
    },
  };
}
