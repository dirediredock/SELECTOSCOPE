// Isomorphic randomization: the one place node and edge order is decided.
// One seeded permutation for the nodes, then a separate one for the edges,
// drawn from one generator, before any computation.

export const SEED = 1736;

// splitmix32: small, fast and identical in every JavaScript engine, so the
// shuffle never depends on where a build runs.
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

// An unbiased integer in [0, k), by rejection.
function below(next: () => number, k: number): number {
  const limit = 0x100000000 - (0x100000000 % k);
  for (;;) {
    const x = next();
    if (x < limit) return x % k;
  }
}

// perm[rank] is the new index of the item at `rank` (Fisher–Yates).
export function permutation(next: () => number, k: number): Uint32Array {
  const perm = new Uint32Array(k);
  for (let i = 0; i < k; i++) perm[i] = i;
  for (let i = k - 1; i > 0; i--) {
    const j = below(next, i + 1);
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  return perm;
}
