// The top eigenpairs of a symmetric operator, one at a time: Lanczos with
// full reorthogonalization, run until the largest Ritz pair converges, then
// locked, and run again orthogonal to it. Locking finds every copy of a
// repeated eigenvalue, which a single Krylov space can't hold: on a sphere
// the three hemisphere waves share one value, and each run finds the next.

import { tridiagonalEigen } from "./dense";

export type Operator = (x: Float64Array, out: Float64Array) => void;

export interface LanczosOptions {
  // Unit vectors the result must be orthogonal to (e.g. the constant
  // vector, an eigenvector already known).
  deflate?: Float64Array[];
  // The starting vector for each run, before it is made orthogonal to the
  // deflated and locked vectors.
  start: (run: number) => Float64Array;
  // Converged when ||A y - θ y|| <= tol * max(scale, |θ|).
  tol?: number;
  scale: number;
  maxIter?: number;
  // The basis size at which a run restarts from its current top Ritz
  // vector, which bounds the cost of reorthogonalization (O(size² n)).
  restart?: number;
}

const dot = (a: Float64Array, b: Float64Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const axpy = (y: Float64Array, a: number, x: Float64Array) => {
  for (let i = 0; i < y.length; i++) y[i] += a * x[i];
};

function orthogonalize(w: Float64Array, basis: Float64Array[]) {
  // Twice is enough (Kahan's "twice is enough").
  for (let pass = 0; pass < 2; pass++) for (const q of basis) axpy(w, -dot(w, q), q);
}

const CHECK_EVERY = 8;

export function topEigenpairs(
  op: Operator,
  n: number,
  k: number,
  opts: LanczosOptions,
): { values: number[]; vectors: Float64Array[] } {
  const tol = opts.tol ?? 1e-10;
  const fixed = opts.deflate ?? [];
  const values: number[] = [];
  const vectors: Float64Array[] = [];
  // Steps per eigenpair: a run without restarts can't pass the space left.
  const maxIter = opts.maxIter ?? (opts.restart ? 100_000 : 3000);
  for (let run = 0; run < k; run++) {
    const against = [...fixed, ...vectors];
    const avail = n - against.length;
    if (avail <= 0) break;
    let q0 = Float64Array.from(opts.start(run));
    orthogonalize(q0, against);
    const norm = Math.sqrt(dot(q0, q0));
    if (norm === 0) break;
    q0 = q0.map((x) => x / norm);
    const restart = opts.restart ?? Infinity;
    let total = 0;
    let theta = 0;
    let y: Float64Array = q0;
    for (;;) {
      const { vector, value, converged, steps } = lanczosRun(op, n, y, against, {
        tol,
        scale: opts.scale,
        limit: Math.min(restart, maxIter - total, avail),
      });
      total += steps;
      y = vector;
      theta = value;
      if (converged || total >= maxIter || (!opts.restart && total >= avail)) break;
    }
    values.push(theta);
    vectors.push(y);
  }
  return { values, vectors };
}

// One Lanczos run from the unit vector q0, orthogonal to `against`, for at
// most `limit` steps: its top Ritz pair, and whether it converged.
function lanczosRun(
  op: Operator,
  n: number,
  q0: Float64Array,
  against: Float64Array[],
  o: { tol: number; scale: number; limit: number },
): { vector: Float64Array; value: number; converged: boolean; steps: number } {
  const Q: Float64Array[] = [q0];
  const alpha: number[] = [];
  const beta: number[] = [];
  const w = new Float64Array(n);
  let converged = false;
  for (let j = 0; ; j++) {
    op(Q[j], w);
    const a = dot(w, Q[j]);
    axpy(w, -a, Q[j]);
    if (j > 0) axpy(w, -beta[j - 1], Q[j - 1]);
    orthogonalize(w, against);
    orthogonalize(w, Q);
    alpha.push(a);
    const b = Math.sqrt(dot(w, w));
    const size = j + 1;
    // An invariant subspace, the budget spent, or time to check.
    const invariant = b < 1e-14 * Math.max(o.scale, Math.abs(a));
    const last = invariant || size >= o.limit;
    if (last || size % CHECK_EVERY === 0) {
      const d = Float64Array.from(alpha);
      const row = new Float64Array(size);
      row[size - 1] = 1;
      tridiagonalEigen(d, Float64Array.from(beta), [row]);
      // The top Ritz pair's residual is b times its last component.
      const theta = Math.abs(d[size - 1]);
      converged = invariant || b * Math.abs(row[size - 1]) <= o.tol * Math.max(o.scale, theta);
      if (converged || last) break;
    }
    const q = new Float64Array(n);
    for (let i = 0; i < n; i++) q[i] = w[i] / b;
    Q.push(q);
    beta.push(b);
  }
  // The top Ritz vector, from the tridiagonal's eigenvectors.
  const size = alpha.length;
  const d = Float64Array.from(alpha);
  const rows = Array.from({ length: size }, (_, i) => {
    const r = new Float64Array(size);
    r[i] = 1;
    return r;
  });
  tridiagonalEigen(d, Float64Array.from(beta.slice(0, size - 1)), rows);
  const y = new Float64Array(n);
  for (let i = 0; i < size; i++) axpy(y, rows[i][size - 1], Q[i]);
  orthogonalize(y, against);
  const norm = Math.sqrt(dot(y, y));
  for (let i = 0; i < n; i++) y[i] /= norm;
  return { vector: y, value: d[size - 1], converged, steps: size };
}
