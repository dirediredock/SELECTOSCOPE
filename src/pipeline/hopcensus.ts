// The Hops pane's lines: each node's stub census and eccentricity.
//
// For source s, let L_i be the nodes i hops away. Its census has one entry per
// hop, 0..ecc(s):
//
//     stubs[i] = e(L_i, L_i+1) + 2 * e(L_i)
//
// the edge ends a breadth-first search from s meets for the first time at hop
// i: those leading on to the next layer, and both ends of each edge inside the
// layer. Entry 0 is the degree. Every edge joins two nodes in the same layer
// or in neighbouring ones, so it counts once, at the nearer of its ends'
// distances, twice when both are equal.

import type { Graph } from "./graph";
import { bfs } from "./graph";

export interface HopCensus {
  ecc: Uint32Array; // by node_idx
  // Each node's ecc + 1 entries, concatenated in node_idx order.
  stubs: Uint32Array;
}

// The census of the sources from..to-1, so a worker can take a chunk.
export function hopCensusRange(g: Graph, from: number, to: number): { ecc: Uint32Array; rows: Uint32Array[] } {
  const { n, m, source, target } = g;
  const dist = new Int32Array(n);
  const queue = new Uint32Array(n);
  const ecc = new Uint32Array(to - from);
  const rows: Uint32Array[] = [];
  for (let s = from; s < to; s++) {
    const far = bfs(g, [s], dist, queue);
    const row = new Uint32Array(far + 1);
    for (let e = 0; e < m; e++) {
      const a = dist[source[e]];
      const b = dist[target[e]];
      if (a === b) row[a] += 2;
      else row[a < b ? a : b] += 1;
    }
    ecc[s - from] = far;
    rows.push(row);
  }
  return { ecc, rows };
}

export function concatCensus(ecc: Uint32Array, rows: Uint32Array[]): HopCensus {
  let total = 0;
  for (const r of rows) total += r.length;
  const stubs = new Uint32Array(total);
  let at = 0;
  for (const r of rows) {
    stubs.set(r, at);
    at += r.length;
  }
  return { ecc, stubs };
}

export function hopCensus(g: Graph): HopCensus {
  const { ecc, rows } = hopCensusRange(g, 0, g.n);
  return concatCensus(ecc, rows);
}
