// The matrix's node orders, each sorting the nodes by one vector, and the
// harmonics FD starts from.
//
//   harm1..3  the combinatorial Laplacian's (L = D - A) eigenvectors after
//             the constant one, smoothest first (harm1 is the Fiedler vector)
//   pc1..3    each node's score on the first principal components of the
//             column-centred adjacency rows X, strongest first: the top
//             eigenvectors of X Xᵀ
//
// Each vector is oriented so the denser end comes first: the quarter of nodes
// with the lowest values has the higher mean degree. Where the two ends
// match (a symmetry swaps them), its largest-magnitude entry is made positive. Then its
// entries are rounded to ROUND decimals so float noise never splits twins, and
// the sort is stable, so ties fall to node_idx. Where an eigenvalue repeats
// (spheres, the torus, lattices), the vectors are used as the solver returns
// them: a repeat is a symmetry of the graph, shown, not fixed.
//
// Up to DENSE_MAX nodes the whole spectrum is solved densely; above that,
// Lanczos finds the few vectors needed (linalg/lanczos.ts). For the
// harmonics it runs on (L + σI)⁻¹, by a sparse factorization
// (linalg/ldl.ts), where L's smallest eigenvalues are far apart, unless the
// factor would fill past FILL_BUDGET times the graph's size. Its start
// vectors are seeded random values, averaged over twins (nodes with the same
// neighbours, open or closed), so the solve can't tell twins apart either.

import { symmetricEigen } from "./linalg/dense";
import { topEigenpairs } from "./linalg/lanczos";
import { factorShiftedLaplacian, solve } from "./linalg/ldl";
import type { Graph } from "./graph";
import { SEED, rng } from "./randomize";

export const WAVES = 3;
export const DENSE_MAX = 400;
export const ROUND = 10;
// Shift-invert: σ well below any λ2 the tool's graphs reach, and the fill
// the factorization may add, as a multiple of n + 2m.
const SIGMA = 1e-6;
const FILL_BUDGET = 40;
// Plain Lanczos restarts from its best vector every RESTART steps, which
// caps the cost of keeping its basis orthogonal.
const RESTART = 80;
export const SERIATIONS = ["harm1", "harm2", "harm3", "pc1", "pc2", "pc3"] as const;
export type Seriation = (typeof SERIATIONS)[number];

export function pinSign(v: Float64Array): Float64Array {
  let big = 0;
  for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[big])) big = i;
  return v[big] < 0 ? v.map((x) => -x) : v;
}

const rounded = (v: Float64Array) => {
  const s = 10 ** ROUND;
  return v.map((x) => Math.round(x * s) / s);
};

// Means closer than this share count as equal: the ends can't be told apart.
const ORIENT_TOL = 1e-9;
// The share of nodes at each end that decides the orientation.
const END_SHARE = 0.25;

// Orients vectors of `g` so the denser end comes first: the quarter of nodes
// with the lowest values has the higher mean degree. Each end takes whole
// ties (every node at or past its threshold), so the ends don't depend on
// node_idx. Ends of equal mean degree (a symmetry swaps them) fall back to
// the largest-magnitude entry. Why the ends, not a correlation over all
// nodes: a core-periphery graph's vectors put the core in the middle, and
// only the ends say which way the drawing faces.
export function orientBy(g: Graph): (v: Float64Array) => Float64Array {
  const { n, offsets } = g;
  const k = Math.max(1, Math.round(n * END_SHARE));
  return (v) => {
    const r = rounded(v);
    const sorted = Float64Array.from(r).sort();
    const lo = sorted[k - 1]!;
    const hi = sorted[n - k]!;
    let sumLo = 0, nLo = 0, sumHi = 0, nHi = 0;
    for (let i = 0; i < n; i++) {
      const d = offsets[i + 1] - offsets[i];
      if (r[i] <= lo) (sumLo += d), nLo++;
      if (r[i] >= hi) (sumHi += d), nHi++;
    }
    const low = sumLo / nLo;
    const high = sumHi / nHi;
    if (Math.abs(low - high) <= ORIENT_TOL * Math.max(low, high)) return pinSign(v);
    return low > high ? v : v.map((x) => -x);
  };
}


// node_idx sorted by value, ties by node_idx.
export function byValue(v: ArrayLike<number>): Uint32Array {
  const order = Array.from({ length: v.length }, (_, i) => i);
  order.sort((a, b) => v[a] - v[b] || a - b);
  return Uint32Array.from(order);
}

// Each node's twin class under open (same neighbours) and closed (same
// neighbours and each other) neighbourhoods: a label per node.
function twinClasses(g: Graph, closed: boolean): Int32Array {
  const label = new Int32Array(g.n);
  const seen = new Map<string, number>();
  for (let v = 0; v < g.n; v++) {
    const nb = Array.from(g.neighbours.subarray(g.offsets[v], g.offsets[v + 1]));
    if (closed) {
      nb.push(v);
      nb.sort((a, b) => a - b);
    }
    const key = nb.join(",");
    let c = seen.get(key);
    if (c === undefined) seen.set(key, (c = seen.size));
    label[v] = c;
  }
  return label;
}

function averageOver(x: Float64Array, label: Int32Array) {
  const sum = new Map<number, [number, number]>();
  label.forEach((c, v) => {
    const s = sum.get(c) ?? [0, 0];
    s[0] += x[v];
    s[1]++;
    sum.set(c, s);
  });
  label.forEach((c, v) => {
    const s = sum.get(c)!;
    x[v] = s[0] / s[1];
  });
}

function startVectors(g: Graph, salt: number) {
  const open = twinClasses(g, false);
  const closed = twinClasses(g, true);
  return (run: number) => {
    const next = rng(SEED + 1000 * salt + run + 1);
    const x = new Float64Array(g.n);
    for (let v = 0; v < g.n; v++) x[v] = next() / 0x100000000 - 0.5;
    averageOver(x, open);
    averageOver(x, closed);
    return x;
  };
}

function maxDegree(g: Graph) {
  let top = 0;
  for (let v = 0; v < g.n; v++) top = Math.max(top, g.offsets[v + 1] - g.offsets[v]);
  return top;
}

function dense(g: Graph, entry: (A: Float64Array[]) => Float64Array[]) {
  const A = Array.from({ length: g.n }, () => new Float64Array(g.n));
  for (let e = 0; e < g.m; e++) A[g.source[e]][g.target[e]] = A[g.target[e]][g.source[e]] = 1;
  return symmetricEigen(entry(A));
}

// The first k harmonics, columns of an n x k result (fewer on a graph of k
// nodes or less), oriented, unrounded.
export function harmonicVectors(g: Graph, k = WAVES): Float64Array[] {
  const { n, offsets, neighbours } = g;
  const want = Math.min(k, n - 1);
  if (n <= DENSE_MAX) {
    const { vectors } = dense(g, (A) =>
      A.map((row, i) => {
        const L = row.map((x) => -x);
        L[i] = offsets[i + 1] - offsets[i];
        return L;
      }),
    );
    return vectors.slice(1, 1 + want).map(orientBy(g));
  }
  const ones = new Float64Array(n).fill(1 / Math.sqrt(n));
  const factor = factorShiftedLaplacian(g, SIGMA, FILL_BUDGET * (n + 2 * g.m));
  if (factor) {
    const op = (x: Float64Array, out: Float64Array) => solve(factor, x, out);
    const { vectors } = topEigenpairs(op, n, want, { deflate: [ones], start: startVectors(g, 1), scale: 0 });
    return vectors.map(orientBy(g));
  }
  // Else: the smallest of L are the largest of c I - L, c past L's largest
  // eigenvalue (at most twice the largest degree); the constant is deflated.
  const c = 2 * maxDegree(g) + 1;
  const op = (x: Float64Array, out: Float64Array) => {
    for (let v = 0; v < n; v++) {
      let s = (c - (offsets[v + 1] - offsets[v])) * x[v];
      for (let i = offsets[v]; i < offsets[v + 1]; i++) s += x[neighbours[i]];
      out[v] = s;
    }
  };
  const { vectors } = topEigenpairs(op, n, want, { deflate: [ones], start: startVectors(g, 1), scale: c, restart: RESTART });
  return vectors.map(orientBy(g));
}

// The first k principal component scores, as harmonicVectors.
export function componentVectors(g: Graph, k = WAVES): Float64Array[] {
  const { n, offsets, neighbours } = g;
  const want = Math.min(k, n);
  const mu = new Float64Array(n);
  for (let v = 0; v < n; v++) mu[v] = (offsets[v + 1] - offsets[v]) / n;
  if (n <= DENSE_MAX) {
    const { vectors } = dense(g, (A) => {
      const X = A.map((row) => row.map((x, j) => x - mu[j]));
      return X.map((xi) => Float64Array.from(X, (xj) => xi.reduce((s, a, t) => s + a * xj[t], 0)));
    });
    return vectors.slice(-want).reverse().map(orientBy(g));
  }
  // X Xᵀ x = A w - 1 (μᵀ w), where w = A x - μ (1ᵀ x).
  const w = new Float64Array(n);
  const op = (x: Float64Array, out: Float64Array) => {
    let sx = 0;
    for (let v = 0; v < n; v++) sx += x[v];
    for (let v = 0; v < n; v++) {
      let s = 0;
      for (let i = offsets[v]; i < offsets[v + 1]; i++) s += x[neighbours[i]];
      w[v] = s - mu[v] * sx;
    }
    let mw = 0;
    for (let v = 0; v < n; v++) mw += mu[v] * w[v];
    for (let v = 0; v < n; v++) {
      let s = 0;
      for (let i = offsets[v]; i < offsets[v + 1]; i++) s += w[neighbours[i]];
      out[v] = s - mw;
    }
  };
  const top = maxDegree(g);
  const { vectors } = topEigenpairs(op, n, want, { start: startVectors(g, 2), scale: top * top + 1, restart: RESTART });
  return vectors.map(orientBy(g));
}

export function seriate(harm: Float64Array[], comp: Float64Array[]): Partial<Record<Seriation, Uint32Array>> {
  const out: Partial<Record<Seriation, Uint32Array>> = {};
  harm.forEach((v, i) => (out[`harm${i + 1}` as Seriation] = byValue(rounded(v))));
  comp.forEach((v, i) => (out[`pc${i + 1}` as Seriation] = byValue(rounded(v))));
  return out;
}
