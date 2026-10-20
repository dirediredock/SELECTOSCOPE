import type { KSnakes } from "../../data/graph";
import { ORDERINGS } from "../../controlOptions";
import type { Ordering, PipelineMode } from "../../state/ksnakes";
import type { SweepAxis } from "../../state/sweep";

// Shells placement, in px at 100% zoom with y up: the pipeline gives each
// node its core, onion layer, island and, per singleton mode and ordering, its
// position in its shell's row (src/pipeline/ksnakes.ts); this turns them
// into bins and positions for the ordering and singleton group picked in the
// bottom strip.

// Per graph, independent of settings and pane size.
export interface SnakeStructure {
  n: number;
  cores: number[]; // shell rank -> its k, ascending
  shellOf: Uint32Array; // node -> shell rank
  minOnion: number;
  maxOnion: number;
  onionShell: Int32Array; // onion layer -> shell rank (-1 below minOnion)
  onionRange: [number, number][]; // shell rank -> its first and last onion layer
  orders: Record<PipelineMode, Record<Ordering, SnakeOrder>>;
}

// A shell's share of one ordering: its members left to right. A pile holds
// the shell's singletons, drawn as pills.
export interface SnakeBin {
  members: Uint32Array;
  pile: boolean;
}

// A pile's singletons on one onion layer, drawn as one pill.
export interface Pill {
  onion: number;
  members: Uint32Array;
}

// One ordering: the bins of each row, left to right, the islands the tubes
// run through (members in x order), and the pills.
export interface SnakeOrder {
  rows: SnakeBin[][];
  islands: Uint32Array[];
  pills: Pill[];
}

function orderOf(ks: KSnakes, shellOf: Uint32Array, shells: number, row: Uint32Array, aggregate: boolean): SnakeOrder {
  const n = ks.core.length;
  const size = new Uint32Array(n);
  for (const g of ks.island) size[g]!++;
  const lone = (v: number) => size[ks.island[v]!] === 1;
  const byShell: number[][] = Array.from({ length: shells }, () => []);
  for (let v = 0; v < n; v++) byShell[shellOf[v]!]!.push(v);
  const rows = byShell.map((vs) => {
    vs.sort((a, b) => row[a]! - row[b]!);
    const bins: number[][] = [];
    vs.forEach((v, i) => {
      const u = vs[i - 1];
      const same = u !== undefined && (ks.island[u] === ks.island[v] || (aggregate && lone(u) && lone(v)));
      if (same) bins[bins.length - 1]!.push(v);
      else bins.push([v]);
    });
    return bins.map((m) => ({ members: Uint32Array.from(m), pile: aggregate && lone(m[0]!) }));
  });
  const islands: Uint32Array[] = [];
  const pills: Pill[] = [];
  for (const bin of rows.flat()) {
    if (!bin.pile) {
      if (bin.members.length > 1) islands.push(bin.members);
      continue;
    }
    const byOnion = new Map<number, number[]>();
    for (const v of bin.members) {
      const o = ks.onion[v]!;
      if (!byOnion.has(o)) byOnion.set(o, []);
      byOnion.get(o)!.push(v);
    }
    for (const [onion, m] of [...byOnion].sort((a, b) => b[0] - a[0])) pills.push({ onion, members: Uint32Array.from(m) });
  }
  return { rows, islands, pills };
}

export function snakeStructure(ks: KSnakes): SnakeStructure {
  const n = ks.core.length;
  const cores = [...new Set(ks.core)].sort((a, b) => a - b);
  const rank = new Map(cores.map((k, i) => [k, i]));
  const shellOf = ks.core.map((k) => rank.get(k)!);
  let minOnion = Infinity, maxOnion = -Infinity;
  for (const o of ks.onion) {
    minOnion = Math.min(minOnion, o);
    maxOnion = Math.max(maxOnion, o);
  }
  const onionShell = new Int32Array(maxOnion + 1).fill(-1);
  const onionRange = cores.map((): [number, number] => [Infinity, -Infinity]);
  for (let v = 0; v < n; v++) {
    const s = shellOf[v]!, o = ks.onion[v]!;
    onionShell[o] = s;
    const r = onionRange[s]!;
    r[0] = Math.min(r[0], o);
    r[1] = Math.max(r[1], o);
  }
  const mode = (m: PipelineMode) => {
    const orders = ks.orders[m];
    if (!orders) throw new Error(`Shells: no ${m} orders`);
    const one = (o: Ordering) => {
      const row = orders.row[o];
      if (!row) throw new Error(`Shells: no ${m} ${o} order`);
      return orderOf(ks, shellOf, cores.length, row, m === "aggregate");
    };
    return Object.fromEntries(ORDERINGS.map((o) => [o.id, one(o.id)])) as Record<Ordering, SnakeOrder>;
  };
  const orders = { separate: mode("separate"), aggregate: mode("aggregate") };
  return { n, cores, shellOf, minOnion, maxOnion, onionShell, onionRange, orders };
}

// Heights for one spacing: each onion layer `step` px above the last, and
// `gap` px more for every K span boundary below it.
export interface SnakeHeights {
  onionY: Float64Array; // onion layer -> y
  height: number; // the top layer's y; the bottom layer is at 0
  spans: { k: number; y0: number; y1: number }[]; // shell rank -> its y extent
  delimiters: number[]; // below the bottom span, midway through each gap between spans, above the top
  bands: [number, number][]; // shell rank -> its band, from delimiter to delimiter
}

export function snakeHeights(st: SnakeStructure, step: number, gap: number): SnakeHeights {
  const onionY = new Float64Array(st.maxOnion + 1);
  for (let o = st.minOnion; o <= st.maxOnion; o++) {
    onionY[o] = (o - st.minOnion) * step + Math.max(0, st.onionShell[o]!) * gap;
  }
  const spans = st.cores.map((k, s) => ({
    k,
    y0: onionY[st.onionRange[s]![0]]!,
    y1: onionY[st.onionRange[s]![1]]!,
  }));
  // The outer bands reach as far past their layers as the inner ones do.
  const pad = (step + gap) / 2;
  const bands = spans.map((sp): [number, number] => [sp.y0 - pad, sp.y1 + pad]);
  const delimiters = [bands[0]![0], ...spans.slice(1).map((sp, i) => (spans[i]!.y1 + sp.y0) / 2), bands.at(-1)![1]];
  return { onionY, height: onionY[st.maxOnion]!, spans, delimiters, bands };
}

// The sweep's axis: from the top layer down, K gaps included, so the band
// runs dense to sparse and takes each gap's time.
export function sweepAxis(onion: Uint32Array, { onionY, height }: SnakeHeights): SweepAxis {
  const nodes = new Float64Array(onion.length);
  for (let v = 0; v < onion.length; v++) nodes[v] = height ? (height - onionY[onion[v]!]!) / height : 0;
  return { nodes };
}

// The sideways axis: left to right, from the rows' left end line to their
// right one, every shell at once. A pill's members share its place.
export function sweepAxisX({ xy, spacing: u }: SnakePlacement, width: number): SweepAxis {
  const n = xy.length / 2;
  const nodes = new Float64Array(n);
  for (let v = 0; v < n; v++) nodes[v] = (xy[2 * v]! + u / 2) / (width + u);
  return { nodes };
}

// A bin's width in node slots: a pile is one pill wide.
const slotsOf = (bin: SnakeBin) => (bin.pile ? 1 : bin.members.length);
// Empty slots between neighbouring bins: one, unless both are single slots.
const spaceBetween = (a: SnakeBin, b: SnakeBin): number => (slotsOf(a) > 1 || slotsOf(b) > 1 ? 1 : 0);

// Positions in one ordering, flattened [x0, y0, ...], across [0, width]: one
// node spacing everywhere, each bin as wide as its island (a pile one pill
// wide), and each row justified to the full width. A pill's members all sit
// at the pill. `cuts` holds each row's bin boundaries (x), and `spacing` is the
// node spacing. The two end cuts sit half a slot outside [0, width], so they
// are a full spacing from the tightest row's end nodes, as far as its inner
// cuts are from theirs, and every row shares them. Each island is centred
// between its cuts, or with `flushRight` (Size) rests against its right cut,
// the spare room to its left; the cuts stay put. With `pull` (Barycenter's
// edges), every row below the densest is placed under its neighbours instead
// (placeUnder), its cuts midway between neighbouring bins.
export interface SnakePlacement {
  xy: Float32Array;
  cuts: number[][];
  spacing: number;
}

export interface SnakePull {
  source: Uint32Array;
  target: Uint32Array;
}

export function snakeXY(
  st: SnakeStructure,
  onion: Uint32Array,
  order: SnakeOrder,
  onionY: Float64Array,
  width: number,
  flushRight: boolean,
  pull: SnakePull | null = null,
): SnakePlacement {
  const xy = new Float32Array(2 * st.n);
  const put = (bin: SnakeBin, x: (i: number) => number) =>
    bin.members.forEach((v, i) => {
      xy[2 * v] = x(bin.pile ? 0 : i);
      xy[2 * v + 1] = onionY[onion[v]!]!;
    });
  const rows = order.rows;
  const cuts: number[][] = rows.map(() => []);
  const gaps = rows.map((bins) => bins.slice(1).map((b, i) => spaceBetween(bins[i]!, b)));
  const total = rows.map((bins, r) => bins.reduce((t, b) => t + slotsOf(b), 0) + gaps[r]!.reduce((t, g) => t + g, 0));
  const u = width / Math.max(1, ...total);
  // Justified: the leftover room is shared between the gaps; one bin is centred.
  const lefts = rows.map((bins, r) => {
    const spare = width - total[r]! * u;
    const extra = bins.length > 1 ? spare / (bins.length - 1) : 0;
    let x = bins.length > 1 ? 0 : spare / 2;
    return bins.map((bin, i) => {
      if (i) x += gaps[r]![i - 1]! * u + extra;
      const left = x;
      x += slotsOf(bin) * u;
      return left;
    });
  });
  if (pull && !flushRight) placeUnder(st.n, rows, gaps, lefts, u, width, pull);
  rows.forEach((bins, r) => {
    const ls = lefts[r]!;
    for (let i = 1; i < bins.length; i++) cuts[r]!.push((ls[i - 1]! + slotsOf(bins[i - 1]!) * u + ls[i]!) / 2);
    bins.forEach((bin, i) => {
      let left = ls[i]!;
      if (flushRight) {
        // A natural half gap inside the right cut, as in the tightest row.
        const last = i === bins.length - 1;
        const cut = last ? width + u / 2 : cuts[r]![i]!;
        const half = ((last ? 1 : gaps[r]![i]!) * u) / 2;
        left = cut - half - slotsOf(bin) * u;
      }
      put(bin, (j) => left + (j + 0.5) * u);
    });
  });
  for (const xs of cuts) {
    xs.unshift(-u / 2);
    xs.push(width + u / 2);
  }
  return { xy, cuts, spacing: u };
}

// Barycenter's placement, row by row from the densest down, in place on `lefts`:
// each bin goes to the mean x of its members' neighbours in denser rows, as
// those rows are placed, an edge d rows away weighing 1/d (the pull that
// ordered it, pipeline/ksnakes.ts). Then the bins move apart only as far as
// their spacing needs, keeping their order and the row inside [0, width]: the
// least total squared distance from their wants, each weighted by its pull
// (pool adjacent violators). A bin with nothing above keeps its justified
// place, as a faint want. The densest row stays justified. The order, and so
// the crossings, never change.
function placeUnder(
  n: number,
  rows: SnakeBin[][],
  gaps: number[][],
  lefts: number[][],
  u: number,
  width: number,
  { source, target }: SnakePull,
) {
  const rowOf = new Int32Array(n);
  const binOf = new Int32Array(n);
  rows.forEach((bins, r) =>
    bins.forEach((bin, i) =>
      bin.members.forEach((v) => {
        rowOf[v] = r;
        binOf[v] = i;
      }),
    ),
  );
  // Each node's neighbours.
  const start = new Uint32Array(n + 1);
  for (let e = 0; e < source.length; e++) {
    start[source[e]! + 1]!++;
    start[target[e]! + 1]!++;
  }
  for (let v = 0; v < n; v++) start[v + 1]! += start[v]!;
  const next = start.slice(0, n);
  const nbr = new Uint32Array(start[n]!);
  for (let e = 0; e < source.length; e++) {
    nbr[next[source[e]!]!++] = target[e]!;
    nbr[next[target[e]!]!++] = source[e]!;
  }
  const centre = (r: number, i: number) => lefts[r]![i]! + (slotsOf(rows[r]![i]!) * u) / 2;

  for (let r = rows.length - 2; r >= 0; r--) {
    const bins = rows[r]!;
    const ls = lefts[r]!;
    if (!bins.length) continue;
    // Each bin's left edge as it wants it, and how hard it pulls.
    const want = bins.map((bin, i) => {
      let s = 0;
      let c = 0;
      for (const v of bin.members) {
        for (let k = start[v]!; k < start[v + 1]!; k++) {
          const w = nbr[k]!;
          const q = rowOf[w]!;
          if (q <= r) continue;
          const pull = 1 / (q - r);
          s += pull * centre(q, binOf[w]!);
          c += pull;
        }
      }
      const half = (slotsOf(bin) * u) / 2;
      return c > 0 ? { left: s / c - half, pull: c } : { left: ls[i]!, pull: 1e-3 };
    });
    // Offsets that keep the spacing; then a non-decreasing fit of left - offset.
    const off: number[] = [0];
    for (let i = 1; i < bins.length; i++) off.push(off[i - 1]! + (slotsOf(bins[i - 1]!) + gaps[r]![i - 1]!) * u);
    const hi = width - (off[bins.length - 1]! + slotsOf(bins[bins.length - 1]!) * u);
    const blocks: { sum: number; pull: number; count: number }[] = [];
    want.forEach(({ left, pull }, i) => {
      blocks.push({ sum: (left - off[i]!) * pull, pull, count: 1 });
      while (blocks.length > 1) {
        const a = blocks[blocks.length - 2]!;
        const b = blocks[blocks.length - 1]!;
        if (a.sum / a.pull <= b.sum / b.pull) break;
        blocks.splice(-2, 2, { sum: a.sum + b.sum, pull: a.pull + b.pull, count: a.count + b.count });
      }
    });
    let i = 0;
    for (const b of blocks) {
      const y = Math.min(hi, Math.max(0, b.sum / b.pull));
      for (let j = 0; j < b.count; j++, i++) ls[i] = y + off[i]!;
    }
  }
}

// Label every onion layer while they are at least `minPx` apart on screen;
// closer than that, every 2nd, 5th, 10th, ... layer.
const STRIDES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
export const onionStride = (stepPx: number, minPx = 14) =>
  STRIDES.find((s) => s * stepPx >= minPx) ?? STRIDES[STRIDES.length - 1]!;
