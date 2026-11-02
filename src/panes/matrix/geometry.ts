import type { Bounds } from "../../canvas/pointView";
import type { Form } from "../../state/matrixPane";
import type { SweepAxis } from "../../state/sweepRun";

// The node x node matrix in its two forms, in layout units (y up). A cell
// is (row, col), both in [0, n): the nodes' positions in the seriation. Cell
// centres sit at +0.5. Both draw every edge twice, mirrored across the empty
// diagonal.
//   square    col to the right, row down
//   diamond   the square turned 45 degrees, standing on a corner: height is
//             row + col, so the diagonal becomes the vertical centre line and
//             an interval of height is a horizontal band
// A pose is a turn between them: the tangent of the angle turned, 0 for the
// square and 1 for the diamond. A pose maps the square's (x, y) to
// (x + pose y, y - pose x), a rotation with a scale the fit takes back out,
// so a change of form can turn smoothly.
// No DOM here, so it is unit-tested directly (geometry.test.ts).

export const POSE: Record<Form, number> = { square: 0, diamond: 1 };

// The pose a share of the way through the turn from the square to the
// diamond: the angle goes evenly, so the turn has a steady speed. The ends
// are exact, which the tangent alone misses by a rounding.
export const poseAt = (share: number) => (share >= 1 ? POSE.diamond : Math.tan((share * Math.PI) / 4));

export function toLayout(pose: number, row: number, col: number): [number, number] {
  return [col - pose * row, -row - pose * col];
}

// Square layout positions, flattened [x0, y0, ...], into `out` at a pose.
export function posed(out: Float32Array, square: ArrayLike<number>, pose: number) {
  for (let i = 0; i < out.length; i += 2) {
    const x = square[i]!, y = square[i + 1]!;
    out[i] = x + pose * y;
    out[i + 1] = y - pose * x;
  }
  return out;
}

// A layout position back to its square (row, col): the inverse of posed()
// after toLayout().
export function unposed(pose: number, x: number, y: number): [number, number] {
  const k = 1 + pose * pose;
  return [-(y + pose * x) / k, (x - pose * y) / k];
}

// The column positions a convex quad crosses, [lo, hi] inclusive, or null
// when it misses the matrix. The quad is four corners in layout units
// ([x0, y0, ...]), at a pose; it is clipped to the matrix in (row, col) and,
// being convex, crosses every column between its extremes.
export function columnsInQuad(quad: ArrayLike<number>, pose: number, n: number): [number, number] | null {
  let poly: [number, number][] = [];
  for (let i = 0; i < quad.length; i += 2) poly.push(unposed(pose, quad[i]!, quad[i + 1]!));
  // Sutherland–Hodgman against row >= 0, row <= n, col >= 0, col <= n.
  for (const [axis, bound, keepAbove] of [
    [0, 0, true],
    [0, n, false],
    [1, 0, true],
    [1, n, false],
  ] as const) {
    const inside = (p: [number, number]) => (keepAbove ? p[axis] >= bound : p[axis] <= bound);
    const out: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[(i + poly.length - 1) % poly.length]!, b = poly[i]!;
      const ina = inside(a), inb = inside(b);
      if (ina !== inb) {
        const t = (bound - a[axis]) / (b[axis] - a[axis]);
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
      if (inb) out.push(b);
    }
    poly = out;
    if (!poly.length) return null;
  }
  let c0 = Infinity, c1 = -Infinity;
  for (const [, c] of poly) {
    c0 = Math.min(c0, c);
    c1 = Math.max(c1, c);
  }
  const lo = Math.min(n - 1, Math.floor(c0));
  const hi = Math.max(lo, Math.min(n - 1, Math.ceil(c1) - 1));
  return [lo, hi];
}

// The whole form's extent, empty corners included: the matrix fits to this,
// not to the points, so every ordering of a dataset fits the same way.
export function formBounds(pose: number, n: number): Bounds {
  return { x0: -pose * n, x1: n, y0: -n - pose * n, y1: 0 };
}

// Distance between neighbouring rows, in layout units (a cell's size).
export const cellSize = (pose: number) => Math.hypot(1, pose);

// The outline's corners, flattened [x0, y0, x1, y1, ...].
export function outline(pose: number, n: number): number[] {
  const corners: [number, number][] = [
    [0, 0],
    [0, n],
    [n, n],
    [n, 0],
  ];
  return corners.flatMap(([r, c]) => toLayout(pose, r, c));
}

// The sweep's two axes, as shares of 2n. Down the diagonal, the edge points
// by row + col + 1 (the diamond's height, top to bottom), each node lit with
// an edge of its, as a Both-mode shape's endpoints are (a band across the
// diamond crosses nearly every column, so nodes do not follow the columns a
// Nodes-mode shape takes). Sideways, the rows and
// columns in seriation order, each node at 2 row + 1, each edge lit when both
// its ends are, as in a node pane.
export function sweepAxis(row: Uint32Array, source: Uint32Array, target: Uint32Array, sideways = false): SweepAxis {
  const span = 2 * row.length;
  if (sideways) {
    const nodes = new Float64Array(row.length);
    for (let v = 0; v < row.length; v++) nodes[v] = (2 * row[v]! + 1) / span;
    return { nodes };
  }
  const edges = new Float64Array(source.length);
  for (let e = 0; e < source.length; e++) edges[e] = (row[source[e]!]! + row[target[e]!]! + 1) / span;
  return { edges };
}

export interface MatrixPoints {
  // Point positions, flattened [x0, y0, x1, y1, ...].
  layout: Float32Array;
  count: number;
  // The edge each point draws: point e and its mirror copy m + e are both
  // edge e.
  edgeOf: Uint32Array;
}

// One point per edge per copy, at its cell centre in the square (posed() turns
// them). `row` maps node_id to its position in the seriation.
export function edgePoints(
  row: Uint32Array,
  source: Uint32Array,
  target: Uint32Array,
): MatrixPoints {
  const m = source.length;
  const count = 2 * m;
  const layout = new Float32Array(2 * count);
  const edgeOf = new Uint32Array(count);
  for (let e = 0; e < m; e++) {
    const a = row[source[e]!]!, b = row[target[e]!]!;
    const lo = Math.min(a, b) + 0.5, hi = Math.max(a, b) + 0.5;
    const [x, y] = toLayout(POSE.square, lo, hi);
    layout[2 * e] = x;
    layout[2 * e + 1] = y;
    edgeOf[e] = e;
    const [mx, my] = toLayout(POSE.square, hi, lo);
    layout[2 * (m + e)] = mx;
    layout[2 * (m + e) + 1] = my;
    edgeOf[m + e] = e;
  }
  return { layout, count, edgeOf };
}

// The row and column of the node at position r, as line segments through its
// cells' centres, flattened [x0, y0, x1, y1, ...].
export function nodeLines(pose: number, n: number, r: number): number[] {
  const c = r + 0.5;
  const segments: [number, number, number, number][] = [
    [c, 0, c, n],
    [0, c, n, c],
  ];
  return segments.flatMap(([r0, c0, r1, c1]) => [...toLayout(pose, r0, c0), ...toLayout(pose, r1, c1)]);
}

// node_id -> position, from a seriation's node_ids in row order.
export function rowsOf(order: Uint32Array): Uint32Array {
  const row = new Uint32Array(order.length);
  for (let i = 0; i < order.length; i++) row[order[i]!] = i;
  return row;
}
