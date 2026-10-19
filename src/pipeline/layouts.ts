// NodeLink's layouts. Every layout is flattened ([x0, y0, x1, ...], or with z
// in 3D), rows by node_idx, and normalized to the unit bounding sphere.
//
//   fd2d       force-directed 2D: Fruchterman–Reingold from the spectral seed.
//              Every graph has it.
//   bespoke2d  the dataset's own 2D (layout_2d.csv), or, failing that, derived
//              from its own 3D seen along its thinnest direction.
//   bespoke3d  the dataset's own 3D (layout_3d.csv) when it has depth; a flat
//              3D counts only as a 2D.

import type { Graph } from "./graph";

// FD's work in node pairs: a pass costs about n^2, so past ~3,000 nodes every
// graph gets the same budget (about 12 s in 2D), and smaller ones the full
// 500 passes.
const FD_WORK = 4.6e9;

export function fdPasses(n: number): number {
  return Math.min(500, Math.max(10, Math.floor(FD_WORK / (n * n))));
}

export function isFlat(coords: Float64Array): boolean {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 2; i < coords.length; i += 3) {
    lo = Math.min(lo, coords[i]);
    hi = Math.max(hi, coords[i]);
  }
  return hi - lo < 1e-9;
}

// Center, then scale to the unit bounding sphere. 3D centres on the mean, the
// natural pivot for a cloud that rotates; 2D on its bounding box, so a shape
// frames by its silhouette.
export function normalize(coords: Float64Array, dim: number): Float64Array {
  const n = coords.length / dim;
  const center = new Float64Array(dim);
  if (dim === 2) {
    for (let a = 0; a < dim; a++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let v = 0; v < n; v++) {
        lo = Math.min(lo, coords[v * dim + a]);
        hi = Math.max(hi, coords[v * dim + a]);
      }
      center[a] = (lo + hi) / 2;
    }
  } else {
    for (let v = 0; v < n; v++) for (let a = 0; a < dim; a++) center[a] += coords[v * dim + a] / n;
  }
  const out = new Float64Array(coords.length);
  let radius = 0;
  for (let v = 0; v < n; v++) {
    let r = 0;
    for (let a = 0; a < dim; a++) {
      const x = coords[v * dim + a] - center[a];
      out[v * dim + a] = x;
      r += x * x;
    }
    radius = Math.max(radius, r);
  }
  radius = Math.sqrt(radius);
  if (radius > 0) for (let i = 0; i < out.length; i++) out[i] /= radius;
  return out;
}

// The 2D view of a 3D layout along its thinnest principal axis: projected
// onto its two widest, each axis's sign fixed so its largest component is
// positive, so a rebuild draws the same picture.
export function flattened(coords: Float64Array): Float64Array {
  const n = coords.length / 3;
  const mean = [0, 0, 0];
  for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) mean[a] += coords[v * 3 + a] / n;
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        C[a * 3 + b] += (coords[v * 3 + a] - mean[a]) * (coords[v * 3 + b] - mean[b]);
      }
    }
  }
  const { vectors } = jacobi3(C);
  const axes = [vectors[2], vectors[1]].map((ax) => {
    let big = 0;
    for (let a = 1; a < 3; a++) if (Math.abs(ax[a]) > Math.abs(ax[big])) big = a;
    return ax[big] < 0 ? ax.map((x) => -x) : ax;
  });
  const out = new Float64Array(n * 2);
  for (let v = 0; v < n; v++) {
    for (let k = 0; k < 2; k++) {
      let s = 0;
      for (let a = 0; a < 3; a++) s += (coords[v * 3 + a] - mean[a]) * axes[k][a];
      out[v * 2 + k] = s;
    }
  }
  return out;
}

// Eigenvectors of a symmetric 3 x 3 matrix (row-major), ascending by value.
function jacobi3(M: number[]): { values: number[]; vectors: number[][] } {
  const A = [...M];
  const V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = A[1] ** 2 + A[2] ** 2 + A[5] ** 2;
    if (off < 1e-30) break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      const apq = A[p * 3 + q];
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (A[q * 3 + q] - A[p * 3 + p]) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = A[k * 3 + p];
        const akq = A[k * 3 + q];
        A[k * 3 + p] = c * akp - s * akq;
        A[k * 3 + q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = A[p * 3 + k];
        const aqk = A[q * 3 + k];
        A[p * 3 + k] = c * apk - s * aqk;
        A[q * 3 + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[k * 3 + p];
        const vkq = V[k * 3 + q];
        V[k * 3 + p] = c * vkp - s * vkq;
        V[k * 3 + q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((a, b) => A[a * 4] - A[b * 4]);
  return {
    values: order.map((i) => A[i * 4]),
    vectors: order.map((i) => [V[i], V[3 + i], V[6 + i]]),
  };
}

export interface OwnLayouts {
  bespoke2d?: { coords: Float64Array; origin: "bespoke" | "derived" };
  bespoke3d?: Float64Array;
}

// The dataset's own layouts, normalized.
export function ownLayouts(own2d: Float64Array | undefined, own3d: Float64Array | undefined): OwnLayouts {
  const out: OwnLayouts = {};
  if (own3d && !isFlat(own3d)) out.bespoke3d = normalize(own3d, 3);
  if (own2d) out.bespoke2d = { coords: normalize(own2d, 2), origin: "bespoke" };
  else if (own3d) out.bespoke2d = { coords: normalize(flattened(own3d), 2), origin: "derived" };
  return out;
}

// Twins' circle, as a share of the seed's spacing.
const TWIN_SPREAD = 0.01;
const SEED_DECIMALS = 10;

// FD's start: the first `dim` harmonics as the axes (H1 for x, H2 for y),
// in the unit square, rounded so float noise never reorders it. Linked nodes
// start close, the mass is balanced about the
// centre, and no random start enters. Returns the positions and the seed
// order: x, then y, then node_idx.
export function spectralSeed(harm: Float64Array[], n: number, dim: number) {
  const xy = new Float64Array(n * dim);
  for (let a = 0; a < Math.min(dim, harm.length); a++) for (let v = 0; v < n; v++) xy[v * dim + a] = harm[a][v];
  let span = 0;
  const lo = new Float64Array(dim);
  for (let a = 0; a < dim; a++) {
    let min = Infinity;
    let max = -Infinity;
    for (let v = 0; v < n; v++) {
      min = Math.min(min, xy[v * dim + a]);
      max = Math.max(max, xy[v * dim + a]);
    }
    lo[a] = min;
    span = Math.max(span, max - min);
  }
  const scale = 10 ** SEED_DECIMALS;
  for (let v = 0; v < n; v++) {
    for (let a = 0; a < dim; a++) {
      xy[v * dim + a] = span > 0 ? Math.round(((xy[v * dim + a] - lo[a]) / span) * scale) / scale : 0;
    }
  }
  const order = Array.from({ length: n }, (_, v) => v);
  order.sort((u, v) => {
    for (let a = 0; a < dim; a++) {
      const d = xy[u * dim + a] - xy[v * dim + a];
      if (d) return d;
    }
    return u - v;
  });
  // Nodes that share a seed (twins) feel no force apart, so they would never
  // separate: they go evenly on a small circle about it, in seed order.
  const spacing = 1 / Math.sqrt(n);
  for (let start = 0; start < n; ) {
    let end = start + 1;
    const same = (u: number, v: number) => {
      for (let a = 0; a < dim; a++) if (xy[u * dim + a] !== xy[v * dim + a]) return false;
      return true;
    };
    while (end < n && same(order[start], order[end])) end++;
    const size = end - start;
    if (size > 1) {
      for (let i = 0; i < size; i++) {
        const angle = (2 * Math.PI * i) / size;
        const v = order[start + i];
        xy[v * dim] += TWIN_SPREAD * spacing * Math.cos(angle);
        xy[v * dim + 1] += TWIN_SPREAD * spacing * Math.sin(angle);
      }
    }
    start = end;
  }
  return { coords: xy, order: Uint32Array.from(order) };
}

// FD 2D: Fruchterman–Reingold from the spectral seed, for fdPasses(n).
// `onFrame` can read the positions, normalized, as they settle. The run goes
// on nodes numbered by the seed order, so any relabelling of the graph runs
// the same arithmetic, and FD is invariant up to the harmonics' signs and
// ties.
export function forceDirected2d(
  g: Graph,
  harm: Float64Array[],
  onFrame?: (pass: number, passes: number, read: () => Float64Array) => void,
): Float64Array {
  return fruchtermanReingold(g, harm, 2, onFrame);
}

// FD 3D: as FD 2D, in three dimensions, seeded by H1, H2 and H3.
export function forceDirected3d(
  g: Graph,
  harm: Float64Array[],
  onFrame?: (pass: number, passes: number, read: () => Float64Array) => void,
): Float64Array {
  return fruchtermanReingold(g, harm, 3, onFrame);
}

// As networkx's spring_layout (method "force") runs it: pairs push apart by
// k^2 / d, edges pull in by d^2 / k, distances floored at 0.01, and each
// pass moves every node by the temperature along its force (or less, when
// the force is under 0.01). The temperature starts at a tenth of the seed's
// width and falls linearly, and the run stops once the mean step is under
// 1e-4. Why each node steps by the temperature: a hub's large force can't
// fling it, so the run never needs a velocity or a cap per node.
function fruchtermanReingold(
  g: Graph,
  harm: Float64Array[],
  dim: 2 | 3,
  onFrame?: (pass: number, passes: number, read: () => Float64Array) => void,
): Float64Array {
  const n = g.n;
  const { coords, order } = spectralSeed(harm, n, dim);
  const rank = new Uint32Array(n);
  order.forEach((v, i) => (rank[v] = i));
  const pos = new Float64Array(n * dim);
  order.forEach((v, i) => {
    for (let a = 0; a < dim; a++) pos[i * dim + a] = coords[v * dim + a];
  });
  const pairs = Array.from({ length: g.m }, (_, e) => {
    const a = rank[g.source[e]];
    const b = rank[g.target[e]];
    return a < b ? [a, b] : [b, a];
  });
  pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const ends = Uint32Array.from(pairs.flat());

  const k = 1 / Math.sqrt(n);
  const k2 = k * k;
  let width = 0;
  for (let a = 0; a < dim; a++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, pos[i * dim + a]);
      hi = Math.max(hi, pos[i * dim + a]);
    }
    width = Math.max(width, hi - lo);
  }
  const passes = fdPasses(n);
  let t = width * 0.1;
  const dt = t / (passes + 1);
  const disp = new Float64Array(n * dim);
  const delta = new Float64Array(dim);

  const read = () => {
    const xyz = new Float64Array(n * dim);
    for (let v = 0; v < n; v++) for (let a = 0; a < dim; a++) xyz[v * dim + a] = pos[rank[v] * dim + a];
    return normalize(xyz, dim);
  };
  for (let pass = 1; pass <= passes; pass++) {
    disp.fill(0);
    for (let i = 0; i < n; i++) {
      const io = i * dim;
      for (let j = i + 1; j < n; j++) {
        const jo = j * dim;
        let d2 = 0;
        for (let a = 0; a < dim; a++) {
          const x = pos[io + a] - pos[jo + a];
          delta[a] = x;
          d2 += x * x;
        }
        const f = k2 / Math.max(d2, 1e-4);
        for (let a = 0; a < dim; a++) {
          disp[io + a] += delta[a] * f;
          disp[jo + a] -= delta[a] * f;
        }
      }
    }
    for (let e = 0; e < ends.length; e += 2) {
      const io = ends[e] * dim;
      const jo = ends[e + 1] * dim;
      let d2 = 0;
      for (let a = 0; a < dim; a++) {
        const x = pos[io + a] - pos[jo + a];
        delta[a] = x;
        d2 += x * x;
      }
      const f = Math.max(Math.sqrt(d2), 0.01) / k;
      for (let a = 0; a < dim; a++) {
        disp[io + a] -= delta[a] * f;
        disp[jo + a] += delta[a] * f;
      }
    }
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let l2 = 0;
      for (let a = 0; a < dim; a++) l2 += disp[i * dim + a] ** 2;
      const s = t / Math.max(Math.sqrt(l2), 0.01);
      for (let a = 0; a < dim; a++) {
        const step = disp[i * dim + a] * s;
        pos[i * dim + a] += step;
        moved += step * step;
      }
    }
    t -= dt;
    if (Math.sqrt(moved) / n < 1e-4) break;
    if (onFrame && pass < passes) onFrame(pass, passes, read);
  }
  return read();
}
