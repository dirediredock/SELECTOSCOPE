// + New's blob: a soft organic shape, a new one on every page load, fitted
// where a thumbnail would sit. Why random: it stands for a graph not yet
// uploaded, so no one shape should become its picture. It is decoration,
// never data, so it is outside the isomorphic randomization.

// Fitted as thumb.ts fits a layout: the shape's larger side at 85% of the
// 100-unit square, centred.
const FIT = 85;

// How soft the joins are: the smooth minimum's reach, in body radii. Small,
// so each lobe meets the body in a neck, with a soft fillet still.
const SOFT = 0.18;

// The field is sampled on a grid this many cells across the square [-R, R]²,
// which holds every lobe with room to spare.
const GRID = 160;
const R = 1.5;

// Points along the traced outline, evenly spaced, enough that the spline
// only smooths them.
const SAMPLES = 96;

type Point = [number, number];

interface Circle {
  x: number;
  y: number;
  r: number;
}

// A polynomial smooth minimum: the union of two shapes with a fillet where
// they meet.
function smin(a: number, b: number, k: number) {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

// Signed distance to the circles' soft union: negative inside.
function field(cs: readonly Circle[], x: number, y: number) {
  const dist = (c: Circle) => Math.hypot(x - c.x, y - c.y) - c.r;
  return cs.slice(1).reduce((d, c) => smin(d, dist(c), SOFT), dist(cs[0]!));
}

// The outline as the longest closed loop of the field's zero contour, by
// marching squares. Why not rays from the centre: a pinched neck is not
// visible from the centre, and a ray would skip it.
function outline(cs: readonly Circle[]): Point[] {
  const n = GRID + 1;
  const at = (i: number) => -R + (2 * R * i) / GRID;
  const f = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) f[j * n + i] = field(cs, at(i), at(j));
  const v = (i: number, j: number) => f[j * n + i]!;

  // Each crossing is named by its grid edge, so two cells sharing an edge
  // share the point, and the segments chain into loops.
  const pos = new Map<string, Point>();
  const links = new Map<string, string[]>();
  const cross = (i0: number, j0: number, i1: number, j1: number) => {
    const key = `${i0},${j0},${i1},${j1}`;
    if (!pos.has(key)) {
      const a = v(i0, j0);
      const t = a / (a - v(i1, j1));
      pos.set(key, [at(i0) + (at(i1) - at(i0)) * t, at(j0) + (at(j1) - at(j0)) * t]);
    }
    return key;
  };
  const link = (a: string, b: string) => {
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  };
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      // The cell's edges, round it, with a crossing where the sign changes.
      const sides: [number, number, number, number][] = [
        [i, j, i + 1, j],
        [i + 1, j, i + 1, j + 1],
        [i, j + 1, i + 1, j + 1],
        [i, j, i, j + 1],
      ];
      const hits = sides.filter(([a, b, c, d]) => v(a, b) < 0 !== v(c, d) < 0).map((s) => cross(...s));
      if (hits.length === 2) link(hits[0]!, hits[1]!);
      else if (hits.length === 4) {
        // A saddle: the centre's sign says which corners join.
        const inside = field(cs, at(i + 0.5), at(j + 0.5)) < 0;
        if (inside === v(i, j) < 0) {
          link(hits[0]!, hits[1]!);
          link(hits[2]!, hits[3]!);
        } else {
          link(hits[0]!, hits[3]!);
          link(hits[1]!, hits[2]!);
        }
      }
    }
  }

  let best: Point[] = [];
  const seen = new Set<string>();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop: Point[] = [];
    let [prev, at_] = ["", start];
    while (!seen.has(at_)) {
      seen.add(at_);
      loop.push(pos.get(at_)!);
      const next = links.get(at_)!.find((k) => k !== prev && !seen.has(k)) ?? start;
      [prev, at_] = [at_, next];
    }
    if (loop.length > best.length) best = loop;
  }
  return best;
}

// `pts` resampled to `k` points evenly spaced along the closed loop.
function resample(pts: Point[], k: number): Point[] {
  const cum = [0];
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i]!, pts[(i + 1) % pts.length]!];
    cum.push(cum[i]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[pts.length]!;
  const out: Point[] = [];
  let s = 0;
  for (let m = 0; m < k; m++) {
    const d = (m / k) * total;
    while (cum[s + 1]! < d) s++;
    const [a, b] = [pts[s]!, pts[(s + 1) % pts.length]!];
    const t = (d - cum[s]!) / (cum[s + 1]! - cum[s]! || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// A closed path in a 100 x 100 viewBox. The shape is a body with three or
// four round lobes of their own sizes set out around it, joined with
// small fillets, so it has round heads on short necks. Its outline is
// traced from the field, then a closed Catmull-Rom spline turns the points
// into cubics.
export function blobPath(rand: () => number): string {
  const lobes = 3 + Math.floor(rand() * 2);
  const turn = rand() * 2 * Math.PI;
  const circles: Circle[] = [{ x: 0, y: 0, r: 0.42 + 0.1 * rand() }];
  for (let i = 0; i < lobes; i++) {
    const a = turn + ((i + (rand() - 0.5) * 0.6) / lobes) * 2 * Math.PI;
    const d = 0.5 + 0.12 * rand();
    circles.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.3 + 0.12 * rand() });
  }
  const pts = resample(outline(circles), SAMPLES);

  // Each segment p1 → p2 with controls from its neighbours.
  const k = pts.length;
  const segs: Point[][] = pts.map((p1, i) => {
    const p0 = pts[(i - 1 + k) % k]!;
    const p2 = pts[(i + 1) % k]!;
    const p3 = pts[(i + 2) % k]!;
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return [c1, c2, p2];
  });

  // Fit by the control polygon, which holds the curve.
  const all = segs.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = FIT / Math.max(x1 - x0, y1 - y0);
  const fit = ([x, y]: Point) =>
    `${(50 + (x - (x0 + x1) / 2) * s).toFixed(2)} ${(50 + (y - (y0 + y1) / 2) * s).toFixed(2)}`;

  return `M${fit(pts[0]!)} ` + segs.map(([c1, c2, p]) => `C${fit(c1!)} ${fit(c2!)} ${fit(p!)}`).join(" ") + " Z";
}
