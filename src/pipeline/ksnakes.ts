// The Shells pane's node placement: shells, onion layers, islands, and two
// orderings of each shell's bins, with singletons separate or aggregated.
//
// Per node:
//   core    the k-core number. Each distinct value is a shell (K1, K2, ...).
//   onion   the onion layer (1..L). Layers rise with core, so a shell holds a
//           contiguous run of them. It is the node's height.
//   island  its enclosure: a connected component using only edges inside one
//           shell. A stable id: the island's rank in the packed order, shell
//           by shell.
//
// Each shell is a row of bins. With singletons separate, every island is a
// bin; aggregated, a shell's single-node islands share one bin. Per singleton
// mode and ordering, `row` is each node's position in its shell's row: a
// bin's members are contiguous, onion descending left to right (each snake
// keeps its staircase), then by their inner rank: by want, degree and
// node_idx. The want is always the one separate topdown gives (the mean
// position of the node's neighbours in other shells).
//
// In a tree island (its own edges one fewer than its members), children
// follow their parents instead: layer by layer, densest first, each member by
// the mean place along the snake of its island neighbours in denser layers
// (none last), then by want, degree and node_idx. Wherever every member has
// at most one such neighbour, each subtree runs contiguous in every layer,
// and no two of the island's edges joining the same two layers cross.
//
// Two edges cross when they join the same two shells and their bins' orders
// swap between the rows. The pane offers two orderings:
//
//   packed    each row by ascending (max onion, sum onion, size): sparse on the
//             left. No pull between shells: the baseline.
//   topdown   one pass down the shells, then one back up. The densest row is
//             in packed order; below it each bin wants the mean position of
//             its neighbours in denser rows, an edge d rows away weighing
//             1/d, so nearer shells pull harder. Bins with nothing above then
//             follow their neighbours below, weighted alike. Every step is a
//             fixed key chain, so equivalent parts are arranged alike.
//
// Positions are normalised per row, (i + 0.5) / len(row), so rows of
// different lengths pull on each other alike. Ties never fall to a previous
// position: bins tie-break by size, onion profile (sorted member onions),
// degree profile (sorted member degrees), then the smallest node_idx.
// node_idx is random (randomize.ts), so it only decides between parts that
// match on every structural key. Wants compare rounded to ROUND, so float
// noise never outranks a structural key.

import type { Graph } from "./graph";
import { degrees } from "./graph";
import type { Cores } from "./cores";

export const ORDERINGS = ["packed", "topdown"] as const;
export type Ordering = (typeof ORDERINGS)[number];
export const SINGLETONS = ["separate", "aggregate"] as const;
export type SingletonMode = (typeof SINGLETONS)[number];

const ROUND = 1e-6;
const quantized = (x: number) => (Number.isNaN(x) ? Infinity : Math.round(x / ROUND) * ROUND);

export interface SnakeOrders {
  row: Record<Ordering, Uint32Array>;
  crossings: Record<Ordering, number>;
}

export interface KSnakes {
  island: Uint32Array;
  orders: Record<SingletonMode, SnakeOrders>;
}

// A sparse weighted adjacency among `size` items: rows of (neighbour, weight).
type Adj = Map<number, number>[];

const adjacency = (size: number): Adj => Array.from({ length: size }, () => new Map());
const addWeight = (A: Adj, a: number, b: number, w = 1) => A[a].set(b, (A[a].get(b) ?? 0) + w);

// Each row's weighted mean of x over its neighbours, NaN where it has none.
function meanOver(A: Adj, x: Float64Array): Float64Array {
  const out = new Float64Array(A.length);
  A.forEach((row, i) => {
    let s = 0;
    let c = 0;
    for (const [j, w] of row) {
      s += w * x[j];
      c += w;
    }
    out[i] = c > 0 ? s / c : NaN;
  });
  return out;
}

function compareTuples(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// The shells, onion layers and islands; the same in every mode.
class Shells {
  n: number;
  source: Uint32Array;
  target: Uint32Array;
  core: Uint32Array;
  onion: Uint32Array;
  degree: Uint32Array;
  shell: Int32Array;
  count: number;
  isl: Int32Array;
  members: number[][];
  cross: Adj;

  constructor(g: Graph, c: Cores) {
    const { n } = g;
    this.n = n;
    this.source = g.source;
    this.target = g.target;
    this.core = c.core;
    this.onion = c.onion;
    this.degree = degrees(g);
    const values = [...new Set(c.core)].sort((a, b) => a - b);
    const index = new Map(values.map((v, i) => [v, i]));
    this.shell = Int32Array.from(c.core, (v) => index.get(v)!);
    this.count = values.length;
    // Islands: components of the edges inside one shell.
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) x = parent[x] = parent[parent[x]];
      return x;
    };
    this.cross = adjacency(n);
    for (let e = 0; e < g.m; e++) {
      const s = g.source[e];
      const t = g.target[e];
      if (this.shell[s] === this.shell[t]) {
        const a = find(s);
        const b = find(t);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      } else {
        addWeight(this.cross, s, t);
        addWeight(this.cross, t, s);
      }
    }
    // Islands numbered by their smallest member, members ascending.
    const label = new Map<number, number>();
    this.isl = new Int32Array(n);
    this.members = [];
    for (let v = 0; v < n; v++) {
      const r = find(v);
      let i = label.get(r);
      if (i === undefined) {
        label.set(r, (i = this.members.length));
        this.members.push([]);
      }
      this.isl[v] = i;
      this.members[i].push(v);
    }
  }
}

// One singleton mode: the bins of each row, their tie keys, and the edge
// weights between bins of different rows.
class Bins {
  sh: Shells;
  members: number[][];
  shell: Int32Array;
  of: Int32Array;
  rows: number[][];
  loc: Int32Array;
  tie: Int32Array;
  top: Float64Array;
  total: Float64Array;
  size: Float64Array;
  W: Adj;
  up: Adj;
  down: Adj;
  // Dense weights between each pair of rows with edges, in each row's own index.
  blocks: { r: number; q: number; M: Float64Array[] }[];

  constructor(sh: Shells, aggregate: boolean) {
    this.sh = sh;
    const members: number[][] = [];
    for (let k = 0; k < sh.count; k++) {
      const lone: number[] = [];
      const islands = [...new Set(sh.members.map((_, i) => i).filter((i) => sh.shell[sh.members[i][0]] === k))];
      for (const i of islands) {
        if (aggregate && sh.members[i].length === 1) lone.push(sh.members[i][0]);
        else members.push(sh.members[i]);
      }
      if (lone.length) members.push(lone.sort((a, b) => a - b));
    }
    this.members = members;
    const B = members.length;
    this.shell = Int32Array.from(members, (m) => sh.shell[m[0]]);
    this.of = new Int32Array(sh.n);
    members.forEach((m, b) => m.forEach((v) => (this.of[v] = b)));
    this.rows = Array.from({ length: sh.count }, () => [] as number[]);
    for (let b = 0; b < B; b++) this.rows[this.shell[b]].push(b);
    this.loc = new Int32Array(B);
    for (const g of this.rows) g.forEach((b, i) => (this.loc[b] = i));

    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
    const keys = members.map((m) => [
      m.length,
      ...sorted(m.map((v) => sh.onion[v])),
      -1,
      ...sorted(m.map((v) => sh.degree[v])),
      -1,
      Math.min(...m),
    ]);
    // The tuple compares (size, onions, degrees, smallest node) in turn: the
    // -1 marks end each profile, and every profile in one comparison has the
    // same length once the sizes tie.
    const byKey = Array.from({ length: B }, (_, b) => b).sort((a, b) => compareTuples(keys[a], keys[b]));
    this.tie = new Int32Array(B);
    byKey.forEach((b, i) => (this.tie[b] = i));
    this.top = Float64Array.from(members, (m) => Math.max(...m.map((v) => sh.onion[v])));
    this.total = Float64Array.from(members, (m) => m.reduce((s, v) => s + sh.onion[v], 0));
    this.size = Float64Array.from(members, (m) => m.length);

    this.W = adjacency(B);
    this.up = adjacency(B);
    this.down = adjacency(B);
    for (let e = 0; e < sh.source.length; e++) {
      const s = sh.source[e];
      const t = sh.target[e];
      if (sh.shell[s] === sh.shell[t]) continue;
      const a = this.of[s];
      const b = this.of[t];
      addWeight(this.W, a, b);
      addWeight(this.W, b, a);
      // The pull: an edge d rows away weighs 1/d. Crossings keep W's counts.
      const w = 1 / Math.abs(this.shell[a] - this.shell[b]);
      addWeight(this.shell[b] > this.shell[a] ? this.up : this.down, a, b, w);
      addWeight(this.shell[a] > this.shell[b] ? this.up : this.down, b, a, w);
    }
    const blocks = new Map<string, { r: number; q: number; M: Float64Array[] }>();
    for (let a = 0; a < B; a++) {
      for (const [b, w] of this.W[a]) {
        const r = this.shell[a];
        const q = this.shell[b];
        if (r >= q) continue;
        const key = `${r},${q}`;
        let block = blocks.get(key);
        if (!block) {
          block = { r, q, M: this.rows[r].map(() => new Float64Array(this.rows[q].length)) };
          blocks.set(key, block);
        }
        block.M[this.loc[a]][this.loc[b]] = w;
      }
    }
    this.blocks = [...blocks.values()].sort((x, y) => x.r - y.r || x.q - y.q);
  }

  positions(orders: number[][]): Float64Array {
    const pos = new Float64Array(this.members.length);
    for (const order of orders) order.forEach((b, i) => (pos[b] = (i + 0.5) / order.length));
    return pos;
  }

  // Row k by its bins' wants (none last), then the tie keys.
  arrange(k: number, want: Float64Array): number[] {
    return [...this.rows[k]].sort((a, b) => quantized(want[a]) - quantized(want[b]) || this.tie[a] - this.tie[b]);
  }

  crossings(orders: number[][]): number {
    let total = 0;
    for (const { r, q, M } of this.blocks) {
      const pr = orders[r].map((b) => this.loc[b]);
      const pq = orders[q].map((b) => this.loc[b]);
      total += pairCrossings(pr.map((i) => pq.map((j) => M[i][j])));
    }
    return total;
  }

  packed(): number[][] {
    return this.rows.map((g) =>
      [...g].sort(
        (a, b) => this.top[a] - this.top[b] || this.total[a] - this.total[b] || this.size[a] - this.size[b] || this.tie[a] - this.tie[b],
      ),
    );
  }

  topdown(): number[][] {
    const orders = this.packed();
    const top = this.sh.count - 1;
    for (let k = top - 1; k >= 0; k--) orders[k] = this.arrange(k, meanOver(this.up, this.positions(orders)));
    // Bins with nothing above take their neighbours below, as placed on the
    // way down; the rest keep their wants from above.
    for (let k = 1; k < top; k++) {
      const pos = this.positions(orders);
      const want = meanOver(this.up, pos);
      const below = meanOver(this.down, pos);
      let orphan = false;
      for (const b of this.rows[k]) {
        if (Number.isNaN(want[b])) {
          want[b] = below[b];
          orphan = true;
        }
      }
      if (orphan) orders[k] = this.arrange(k, want);
    }
    return orders;
  }

  // Each node's pull inside its bin: the mean position of its neighbours in
  // other shells (none: NaN).
  want(orders: number[][]): Float64Array {
    const pos = this.positions(orders);
    const at = Float64Array.from(this.of, (b) => pos[b]);
    return meanOver(this.sh.cross, at);
  }

  // Each node's position in its shell's row: bins in order, members by onion
  // descending, then their inner rank.
  row(orders: number[][], inner: Int32Array): Uint32Array {
    const { onion } = this.sh;
    const row = new Uint32Array(this.sh.n);
    for (const order of orders) {
      let at = 0;
      for (const b of order) {
        const m = [...this.members[b]].sort((u, v) => onion[v] - onion[u] || inner[u] - inner[v]);
        m.forEach((v, i) => (row[v] = at + i));
        at += m.length;
      }
    }
    return row;
  }
}

// Crossings between the edges of a weighted block, rows and columns in
// left-to-right order: pairs (a, x), (b, y) with a left of b and y left of x,
// each counted weight times weight.
export function pairCrossings(M: number[][]): number {
  const R = M.length;
  if (R === 0) return 0;
  const C = M[0].length;
  // below[x] = the weight in rows below the current one at columns < x.
  const below = new Float64Array(C + 1);
  let total = 0;
  for (let a = R - 1; a >= 0; a--) {
    for (let x = 0; x < C; x++) total += M[a][x] * below[x];
    // Fold row a in: prefix sums over columns.
    let run = 0;
    const next = new Float64Array(C + 1);
    for (let x = 0; x < C; x++) {
      run += M[a][x];
      next[x + 1] = below[x + 1] + run;
    }
    below.set(next);
  }
  return total;
}

// Each node's rank among its island's layer: by want (none last), degree and
// node_idx, except in a tree island, where children follow parents.
function innerRanks(sh: Shells, want: Float64Array): Int32Array {
  const n = sh.n;
  const byStart = Array.from({ length: n }, (_, v) => v).sort(
    (a, b) => quantized(want[a]) - quantized(want[b]) || sh.degree[a] - sh.degree[b] || a - b,
  );
  const start = new Int32Array(n);
  byStart.forEach((v, i) => (start[v] = i));
  const rank = Int32Array.from(start);
  const edges = new Int32Array(sh.members.length);
  const above = new Map<number, number[]>(); // each node's island neighbours in denser layers
  for (let e = 0; e < sh.source.length; e++) {
    const u = sh.source[e];
    const v = sh.target[e];
    if (sh.isl[u] !== sh.isl[v]) continue;
    edges[sh.isl[u]]++;
    if (sh.onion[u] < sh.onion[v]) above.set(u, [...(above.get(u) ?? []), v]);
    else if (sh.onion[v] < sh.onion[u]) above.set(v, [...(above.get(v) ?? []), u]);
  }
  const place = new Float64Array(n); // along the snake, densest layer first
  sh.members.forEach((m, i) => {
    if (m.length < 2 || edges[i] !== m.length - 1) return;
    let at = 0;
    const layers = [...new Set(m.map((v) => sh.onion[v]))].sort((a, b) => b - a);
    for (const o of layers) {
      const g = m.filter((v) => sh.onion[v] === o);
      const parent = new Map(
        g.map((v) => {
          const up = above.get(v);
          return [v, up ? quantized(up.reduce((s, u) => s + place[u], 0) / up.length) : Infinity];
        }),
      );
      g.sort((a, b) => parent.get(a)! - parent.get(b)! || start[a] - start[b]);
      const slots = g.map((v) => start[v]).sort((a, b) => a - b);
      g.forEach((v, j) => {
        rank[v] = slots[j];
        place[v] = at + j;
      });
      at += g.length;
    }
  });
  return rank;
}

export function ksnakes(g: Graph, c: Cores): KSnakes {
  const sh = new Shells(g, c);
  let island: Uint32Array | null = null;
  let inner: Int32Array | null = null;
  const orders = {} as Record<SingletonMode, SnakeOrders>;
  for (const mode of SINGLETONS) {
    // Separate first: its topdown sets the want.
    const bins = new Bins(sh, mode === "aggregate");
    const placed: Record<Ordering, number[][]> = { packed: bins.packed(), topdown: bins.topdown() };
    if (!inner) inner = innerRanks(sh, bins.want(placed.topdown));
    orders[mode] = {
      row: { packed: bins.row(placed.packed, inner), topdown: bins.row(placed.topdown, inner) },
      crossings: { packed: bins.crossings(placed.packed), topdown: bins.crossings(placed.topdown) },
    };
    if (mode === "separate") {
      const packedRank = new Int32Array(sh.members.length);
      let k = 0;
      for (const order of placed.packed) for (const b of order) packedRank[sh.isl[bins.members[b][0]]] = k++;
      island = Uint32Array.from(sh.isl, (i) => packedRank[i]);
    }
  }
  return { island: island!, orders };
}
