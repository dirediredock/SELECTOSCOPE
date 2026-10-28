import type { HopCensus } from "../../data/graph";
import type { CensusMeasure } from "../../state/hops";
import type { SweepAxis } from "../../state/sweep";

// Hops placement, in layout units with y up: one polyline per node
// through its stub census (src/pipeline/hopcensus.ts), in the bin of its
// eccentricity. Each bin is a square `side` wide, stacked in one column with
// no gap. Every line starts at hop 0 on the left, on one x scale out to the
// largest eccentricity. Heights run linearly from 0 at a bin's bottom to the
// graph's largest entry at its top, one scale for every bin, so heights
// compare across bins.
//
// Spacing moves each line right by its place in the shape order: one
// measure of its census in percent (censusValues), each with a fixed end on the left
// (LEFT), so lines at one x have alike values in every bin. Each line's key is
// its value, or by rank its class (0, 1, 2, ... for the distinct values), and
// one rule places every key: scaled so the two ends sit at 0 and 1, and with
// no spread in the middle. So by rank the classes stand as evenly spaced
// columns, twins sharing one; by value gaps and outliers show; and a single
// value sits centred in either. The sweep runs the same places, in every bin.

// Per graph, independent of settings and pane size.
export interface CensusStructure {
  n: number;
  eccs: number[]; // bin rank -> its eccentricity, ascending: the top bin first
  binOf: Uint32Array; // node -> bin rank
  top: number; // the graph's largest entry
  maxEcc: number;
  values: Record<CensusMeasure, Float64Array>; // measure -> node -> its value
}

// `present` marks the nodes whose census has landed while the build runs;
// the others have no line, take no bin and sit at 0 in every measure.
export function censusStructure(hc: HopCensus, present?: Uint8Array): CensusStructure {
  const n = hc.ecc.length;
  const eccs = [...new Set(present ? hc.ecc.filter((_, v) => present[v]) : hc.ecc)].sort((a, b) => a - b);
  const rank = new Map(eccs.map((e, i) => [e, i]));
  const binOf = hc.ecc.map((e) => rank.get(e) ?? 0);
  let top = 0;
  for (const x of hc.stubs) top = Math.max(top, x);
  return {
    n,
    eccs,
    binOf,
    top,
    maxEcc: eccs[eccs.length - 1] ?? 0,
    values: censusValues(hc, present),
  };
}

// Each line's measures, every one a percent, read from its census as a
// distribution over hops (divided by its total, so a line's size never
// counts): degree, its first entry over the other nodes (n − 1), its degree
// centrality, so it reads as the line's first height; reach, its mean
// hop as a share of its eccentricity; spread, its standard deviation in
// hops, as a share of its eccentricity; and skew, which side of the mean hop
// the shape's width lies on: how much further its last tenth lies past the mean
// hop than its first tenth lies before it (arrival), as a share of its
// eccentricity, positive for a long tail and negative for a long run-up. A
// skewness read from tenths, not the third moment, which within a bin mostly
// repeats reach; tenths, not quartiles, which jitter a third more for one
// dropped edge. Why
// shares of the eccentricity: one order places every bin's lines together,
// and in hops a short bin's lines would all sit at one end.
export function censusValues({ ecc, offset, stubs }: HopCensus, present?: Uint8Array): Record<CensusMeasure, Float64Array> {
  const n = offset.length - 1;
  const degree = new Float64Array(n);
  const reach = new Float64Array(n);
  const spread = new Float64Array(n);
  const skew = new Float64Array(n);
  const has = (v: number) => !present || present[v] === 1;
  const others = Math.max(1, n - 1);
  for (let v = 0; v < n; v++) {
    if (!has(v)) continue;
    const first = offset[v]!, end = offset[v + 1]!;
    let total = 0, sum = 0;
    for (let i = first; i < end; i++) {
      total += stubs[i]!;
      sum += stubs[i]! * (i - first);
    }
    const mean = sum / total;
    let m2 = 0;
    for (let i = first; i < end; i++) {
      const d = i - first - mean;
      m2 += stubs[i]! * d * d;
    }
    const span = Math.max(1, ecc[v]!);
    degree[v] = stubs[first]! / others;
    reach[v] = mean / span;
    spread[v] = Math.sqrt(m2 / total) / span;
    const line = stubs.subarray(first, end);
    skew[v] = (arrival(line, 0.1) + arrival(line, 0.9) - 2 * mean) / span;
  }
  return { degree, reach, spread, skew };
}

// Where a share of a line's census has arrived, in hops: each hop's entries
// spread evenly from half a hop before it to half a hop after, so the point
// moves smoothly as the census changes, never jumping a whole hop.
export function arrival(entries: ArrayLike<number>, share: number): number {
  let total = 0;
  for (let i = 0; i < entries.length; i++) total += entries[i]!;
  const need = share * total;
  let met = 0;
  for (let i = 0; i < entries.length; i++) {
    const x = entries[i]!;
    if (x > 0 && met + x >= need) return i - 0.5 + (need - met) / x;
    met += x;
  }
  return entries.length - 0.5;
}

// Each line's place along the horizontal order, as drawn and as swept.
export interface CensusOrder {
  place: Float32Array; // node -> its place along the order, in [0, 1]
  sweep: Float32Array; // node -> its place on the sweep's circle, in [0, 1)
}

// Which end of each measure sits left: 1 its largest values, -1 its smallest.
// Fixed per measure, never per graph, so an order always reads one way, and
// chosen so a new order moves the lines least. Over every curated dataset, by
// rank over every node, a line moves a median 0.321 of the width between two
// orders with these ends, the least of the eight choices (the next 0.346; 1/3
// is two unrelated orders): Reach to Skew 0.24, the rest 0.32 to 0.38. By
// value it moves 0.315, near the least there (0.299, with Reach and Skew
// turned round, which by rank moves 0.353), so these ends serve both.
export const LEFT: Record<CensusMeasure, 1 | -1> = { degree: 1, reach: -1, spread: 1, skew: 1 };

export function censusOrder({ values }: CensusStructure, measure: CensusMeasure, byRank: boolean): CensusOrder {
  // Rounded to 12 decimals, so float noise never splits a class or spreads
  // one; signed, so the left end's values come first.
  const key = values[measure].map((x) => -LEFT[measure] * Math.round(x * 1e12));
  const ranks = classRanks(key);
  const place = scaled(byRank ? Float64Array.from(ranks) : key);
  // Down the sweep the bins sit end to end, and a wrapping band runs from the
  // end back to the start, so the circle keeps one class's step after the last
  // column, or that would light with the first: by rank class c sits at
  // c / C, so each takes an equal share of the pass; by value the gaps keep
  // their proportions.
  let classes = 0;
  for (const r of ranks) classes = Math.max(classes, r + 1);
  const turn = (classes - 1) / Math.max(1, classes);
  return { place, sweep: place.map((p) => p * turn) };
}

// Each line's class, smallest key first: lines with one key share one, so twins
// always do, and no class depends on node_id.
function classRanks(key: Float64Array): Uint32Array {
  const order = Array.from(key.keys()).sort((a, b) => key[a]! - key[b]!);
  const rank = new Uint32Array(key.length);
  for (let i = 1; i < order.length; i++) {
    const v = order[i]!, u = order[i - 1]!;
    rank[v] = rank[u]! + (key[v] === key[u] ? 0 : 1);
  }
  return rank;
}

// Each key scaled so the smallest sits at 0 and the largest at 1. Keys with
// no spread have no ends, so they sit in the middle.
function scaled(key: Float64Array): Float32Array {
  let lo = Infinity, hi = -Infinity;
  for (const k of key) {
    lo = Math.min(lo, k);
    hi = Math.max(hi, k);
  }
  return Float32Array.from(key, (k) => (hi > lo ? (k - lo) / (hi - lo) : 0.5));
}

// The sweep's axis: down the bins, the top one first, each an equal share as
// its square is; within a bin, along the lines' places on the sweep's circle,
// its left end first, so each bin reads left to right as Spacing moves it, and
// its last line never lands on the next bin's start. Sideways it runs along
// the lines' places, every bin at once, on the circle if the band wraps: by
// rank each step passes a column, by value the gaps pass empty. Both read the place, not the drawn offset, so
// they sweep the same at any Spacing, 0 included.
export function sweepAxis(
  { n, eccs, binOf }: Pick<CensusStructure, "n" | "eccs" | "binOf">,
  { place, sweep }: CensusOrder,
  sideways = false,
  wrap = false,
): SweepAxis {
  if (sideways) return { nodes: Float64Array.from(wrap ? sweep : place) };
  const bins = eccs.length;
  const nodes = new Float64Array(n);
  for (let v = 0; v < n; v++) nodes[v] = (binOf[v]! + sweep[v]!) / bins;
  return { nodes };
}

export interface CensusBin {
  ecc: number;
  y0: number; // its bottom
  y1: number; // its top
}

// Every vertex, flattened [x0, y0, ...] in census order (node v's line is
// vertices offset[v] .. offset[v + 1]), with the bins.
export interface CensusPlacement {
  xy: Float32Array;
  bins: CensusBin[]; // by rank, the top bin first
  height: number; // the top bin's top; the bottom bin's bottom is at 0
}

// `slide` is how far right a line at the order's far end moves, as a fraction
// of `side`, and `place` each line's place along the order (censusOrder).
export interface CensusLook {
  slide?: number;
  place?: Float32Array;
}

export function censusXY(st: CensusStructure, hc: HopCensus, side: number, { slide = 0, place }: CensusLook = {}): CensusPlacement {
  const count = st.eccs.length;
  const bins = st.eccs.map((ecc, r): CensusBin => {
    const y0 = (count - 1 - r) * side;
    return { ecc, y0, y1: y0 + side };
  });
  const dx = side / Math.max(1, st.maxEcc);
  const scale = side / Math.max(1, st.top);
  const xy = new Float32Array(2 * hc.stubs.length);
  for (let v = 0; v < st.n; v++) {
    const shift = (place?.[v] ?? 0) * slide * side;
    const { y0 } = bins[st.binOf[v]!]!;
    const first = hc.offset[v]!;
    for (let i = first; i < hc.offset[v + 1]!; i++) {
      xy[2 * i] = (i - first) * dx + shift;
      xy[2 * i + 1] = y0 + hc.stubs[i]! * scale;
    }
  }
  return { xy, bins, height: count ? bins[0]!.y1 : 0 };
}

// Marks `pitchPx` apart on screen (E labels): every one while
// they are at least `minPx` apart; closer than that, every 2nd, 5th, 10th, ...
const STRIDES = [1, 2, 5, 10, 20, 50, 100];
export const strideFor = (pitchPx: number, minPx: number) =>
  STRIDES.find((s) => s * pitchPx >= minPx) ?? STRIDES[STRIDES.length - 1]!;
