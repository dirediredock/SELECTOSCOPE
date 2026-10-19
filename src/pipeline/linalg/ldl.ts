// A sparse LDLᵀ factorization of L + σI (L the graph Laplacian), for
// shift-invert: solving with it turns L's smallest eigenvalues into the
// largest, well apart, so Lanczos needs a few dozen steps where it would
// otherwise need thousands on a long, thin graph (a road map, a tree).
//
// Nodes are eliminated by minimum degree (a heap on each node's current
// degree, ties by node_idx), which keeps the fill small on sparse graphs. The
// factorization gives up past a fill budget and returns null, and the
// caller falls back to plain Lanczos.

import type { Graph } from "../graph";

export interface Factor {
  n: number;
  order: Int32Array; // elimination order
  d: Float64Array; // pivots, by elimination step
  // L's column for step k: rows rowIdx[colStart[k] .. colStart[k + 1]),
  // node_idx, with values vals.
  colStart: Int32Array;
  rowIdx: Int32Array;
  vals: Float64Array;
}

class Heap {
  private keys: number[] = [];
  private nodes: number[] = [];
  push(key: number, node: number) {
    const k = this.keys;
    const v = this.nodes;
    let i = k.length;
    k.push(key);
    v.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] < key || (k[p] === key && v[p] < node)) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = node;
  }
  pop(): [number, number] | null {
    const k = this.keys;
    const v = this.nodes;
    if (!k.length) return null;
    const top: [number, number] = [k[0], v[0]];
    const key = k.pop()!;
    const node = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= k.length) break;
        const r = l + 1;
        const c = r < k.length && (k[r] < k[l] || (k[r] === k[l] && v[r] < v[l])) ? r : l;
        if (key < k[c] || (key === k[c] && node < v[c])) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = key;
      v[i] = node;
    }
    return top;
  }
}

export function factorShiftedLaplacian(g: Graph, sigma: number, budget: number): Factor | null {
  const { n, offsets, neighbours } = g;
  const rows: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  const diag = new Float64Array(n);
  for (let v = 0; v < n; v++) {
    diag[v] = offsets[v + 1] - offsets[v] + sigma;
    for (let i = offsets[v]; i < offsets[v + 1]; i++) rows[v].set(neighbours[i], -1);
  }
  const heap = new Heap();
  for (let v = 0; v < n; v++) heap.push(rows[v].size, v);
  const gone = new Uint8Array(n);
  const order = new Int32Array(n);
  const d = new Float64Array(n);
  const colStart = new Int32Array(n + 1);
  const rowIdx: number[] = [];
  const vals: number[] = [];
  let stored = 0;
  for (let k = 0; k < n; ) {
    const top = heap.pop()!;
    const v = top[1];
    if (gone[v] || top[0] !== rows[v].size) continue; // a stale entry
    gone[v] = 1;
    const dk = diag[v];
    order[k] = v;
    d[k] = dk;
    const nb = [...rows[v]];
    for (const [j, a] of nb) {
      rowIdx.push(j);
      vals.push(a / dk);
    }
    colStart[k + 1] = rowIdx.length;
    // The Schur complement: v's neighbours become a clique.
    for (let x = 0; x < nb.length; x++) {
      const [i, ai] = nb[x];
      const ri = rows[i];
      ri.delete(v);
      diag[i] -= (ai * ai) / dk;
      for (let y = x + 1; y < nb.length; y++) {
        const [j, aj] = nb[y];
        const delta = (ai * aj) / dk;
        const was = ri.get(j);
        if (was === undefined) {
          stored += 2;
          if (stored > budget) return null;
          ri.set(j, -delta);
          rows[j].set(i, -delta);
        } else {
          ri.set(j, was - delta);
          rows[j].set(i, was - delta);
        }
      }
    }
    for (const [i] of nb) heap.push(rows[i].size, i);
    rows[v].clear();
    k++;
  }
  return { n, order, d, colStart, rowIdx: Int32Array.from(rowIdx), vals: Float64Array.from(vals) };
}

// x = (L D Lᵀ)⁻¹ b, into `out`.
export function solve(f: Factor, b: Float64Array, out: Float64Array) {
  const { n, order, d, colStart, rowIdx, vals } = f;
  out.set(b);
  for (let k = 0; k < n; k++) {
    const yk = out[order[k]];
    for (let p = colStart[k]; p < colStart[k + 1]; p++) out[rowIdx[p]] -= vals[p] * yk;
  }
  for (let k = 0; k < n; k++) out[order[k]] /= d[k];
  for (let k = n - 1; k >= 0; k--) {
    const v = order[k];
    let s = out[v];
    for (let p = colStart[k]; p < colStart[k + 1]; p++) s -= vals[p] * out[rowIdx[p]];
    out[v] = s;
  }
}
