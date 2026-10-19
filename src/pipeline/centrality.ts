// Eigenvector centrality for the Labels pane's sort: the adjacency's leading
// eigenvector, by absolute value, at unit length, by node_idx.
//
// Lanczos from the constant vector (linalg/lanczos.ts), so it is
// deterministic, and the constant start is the same on twins, so they come
// out equal. The graph is connected, so the leading eigenvector is unique
// and positive. Values are rounded to ROUND decimals, so float noise never
// splits nodes that structure can't tell apart, and their ties fall to the
// sort's own tie-breaks.

import type { Graph } from "./graph";
import { topEigenpairs } from "./linalg/lanczos";

export const ROUND = 10;

export function eigenvectorCentrality(g: Graph): Float64Array {
  const { n, offsets, neighbours } = g;
  if (n === 1) return Float64Array.of(1);
  let top = 0;
  for (let v = 0; v < n; v++) top = Math.max(top, offsets[v + 1] - offsets[v]);
  const op = (x: Float64Array, out: Float64Array) => {
    for (let v = 0; v < n; v++) {
      let s = 0;
      for (let i = offsets[v]; i < offsets[v + 1]; i++) s += x[neighbours[i]];
      out[v] = s;
    }
  };
  const { vectors } = topEigenpairs(op, n, 1, { start: () => new Float64Array(n).fill(1), scale: top, tol: 1e-12, restart: 60 });
  const scale = 10 ** ROUND;
  return vectors[0].map((v) => Math.round(Math.abs(v) * scale) / scale);
}
