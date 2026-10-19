// The graph every stage reads: connected, undirected and simple, indexed by
// the randomized node_idx / edge_idx (randomize.ts).

export interface Graph {
  n: number;
  m: number;
  // Provenance: each node's id as written in the CSVs, and each edge's row
  // in edgelist.csv (0 for the first row after the header).
  nodeId: string[];
  edgeRow: Uint32Array;
  // By edge_idx, oriented source < target.
  source: Uint32Array;
  target: Uint32Array;
  // CSR adjacency: node v's neighbours are neighbours[offsets[v] .. offsets[v + 1]),
  // ascending by node_idx, and incident[] holds the edge_idx of each.
  offsets: Uint32Array;
  neighbours: Uint32Array;
  incident: Uint32Array;
}

export function buildGraph(nodeId: string[], edgeRow: Uint32Array, source: Uint32Array, target: Uint32Array): Graph {
  const n = nodeId.length;
  const m = edgeRow.length;
  const offsets = new Uint32Array(n + 1);
  for (let e = 0; e < m; e++) {
    offsets[source[e] + 1]++;
    offsets[target[e] + 1]++;
  }
  for (let v = 0; v < n; v++) offsets[v + 1] += offsets[v];
  const fill = offsets.slice(0, n);
  const neighbours = new Uint32Array(2 * m);
  const incident = new Uint32Array(2 * m);
  for (let e = 0; e < m; e++) {
    const s = source[e];
    const t = target[e];
    neighbours[fill[s]] = t;
    incident[fill[s]++] = e;
    neighbours[fill[t]] = s;
    incident[fill[t]++] = e;
  }
  // Neighbours ascending by node_idx, so every traversal is in a fixed order.
  for (let v = 0; v < n; v++) {
    const lo = offsets[v];
    const hi = offsets[v + 1];
    const pairs = [];
    for (let i = lo; i < hi; i++) pairs.push([neighbours[i], incident[i]]);
    pairs.sort((a, b) => a[0] - b[0]);
    for (let i = lo; i < hi; i++) {
      neighbours[i] = pairs[i - lo][0];
      incident[i] = pairs[i - lo][1];
    }
  }
  return { n, m, nodeId, edgeRow, source, target, offsets, neighbours, incident };
}

export function degrees(g: Graph): Uint32Array {
  const d = new Uint32Array(g.n);
  for (let v = 0; v < g.n; v++) d[v] = g.offsets[v + 1] - g.offsets[v];
  return d;
}

// Hops from `sources` (one BFS from all of them at once) into `dist`, which
// it fills; returns the largest distance. -1 marks unreached nodes, so a
// connected graph leaves none.
export function bfs(g: Graph, sources: ArrayLike<number>, dist: Int32Array, queue: Uint32Array): number {
  dist.fill(-1);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    if (dist[s] < 0) {
      dist[s] = 0;
      queue[tail++] = s;
    }
  }
  let far = 0;
  const { offsets, neighbours } = g;
  while (head < tail) {
    const v = queue[head++];
    const d = dist[v] + 1;
    for (let i = offsets[v]; i < offsets[v + 1]; i++) {
      const w = neighbours[i];
      if (dist[w] < 0) {
        dist[w] = d;
        if (d > far) far = d;
        queue[tail++] = w;
      }
    }
  }
  return far;
}
