// The graph on screen, in the form the panes read. Indexed by the randomized
// node_idx / edge_idx throughout.
//
// One Graph object stands for one dataset for as long as it is shown: its
// identity changing means a new dataset (a fresh start for every pane). The
// engine fills its stage fields in place as each result lands, and bumps
// the data store's revision, so the panes redraw with what is there. A
// field still null is a stage still running.

import type { Cores } from "../pipeline/cores";
import type { KSnakes as Orders } from "../pipeline/ksnakes";
import type { Graph as Csr } from "../pipeline/graph";
import type { CleanReport, Refusal, Warning } from "../pipeline/ingest";
import type { Seriation } from "../pipeline/seriations";

// NodeLink's layouts: computed by the engine, read from a file the dataset
// brought, or derived from its own 3D.
export type LayoutOrigin = "computed" | "bespoke" | "derived";

// The view NodeLink opens a curated dataset in (its manifest's view): its
// own 3D (a native shape), its own 2D (a map), or the default.
export type OpeningView = "3d" | "2d" | null;

// The Hops pane's lines: node v's stub census is
// stubs[offset[v] .. offset[v + 1]), ecc[v] + 1 entries, one per hop.
// The Shells pane's placement, by node_idx: k-core and onion layer, the
// island, and per singleton mode each ordering's row positions
// (pipeline/ksnakes.ts).
export type KSnakes = Cores & Orders;

export interface HopCensus {
  ecc: Uint32Array;
  offset: Uint32Array;
  stubs: Uint32Array;
}

// The census while it lands, chunk by chunk.
export interface HopRows {
  ecc: Uint32Array;
  rows: (Uint32Array | undefined)[];
  done: number;
}

export interface Graph {
  name: string;
  title: string;
  n: number;
  m: number;
  // Provenance: the ids as written in the CSVs.
  nodeId: string[];
  edgeRow: Uint32Array;
  csr: Csr;
  degree: Uint32Array;
  // "" for every node when the dataset has no labels.csv.
  labels: string[];
  hasLabels: boolean;
  edgeSource: Uint32Array;
  edgeTarget: Uint32Array;
  // What cleaning changed; null for a graph loaded from a build file, which
  // doesn't keep it (no file pill shows it).
  report: CleanReport | null;
  refused: Refusal[];
  // Files that loaded with something to note (labels for only some nodes).
  warnings: Warning[];
  view: OpeningView;

  // Filled as stages land. Layouts are flattened ([x0, y0, x1, ...], or with
  // z in 3D) in the unit bounding sphere.
  // FD 2D and FD 3D are computed; the own layouts are the dataset's (bespoke, or a 2D derived from its 3D).
  layoutFd: Float32Array | null;
  layoutFdOrigin: LayoutOrigin;
  layoutFd3d: Float32Array | null;
  layoutFd3dOrigin: LayoutOrigin;
  layoutOwn2d: Float32Array | null;
  layoutOwn2dOrigin: LayoutOrigin;
  layoutOwn3d: Float32Array | null;
  harmonics: Float64Array[] | null;
  seriations: Partial<Record<Seriation, Uint32Array>>;
  cores: Cores | null;
  // The Shells pane's placement: core and onion again, beside the islands
  // and orderings.
  ksnakes: KSnakes | null;
  hopRows: HopRows | null;
  hopCensus: HopCensus | null;
}

// The census so far, while its rows land: a node whose row hasn't landed has
// an empty one, and `present` marks the rest.
export function censusSoFar(rows: HopRows): { census: HopCensus; present: Uint8Array } {
  const n = rows.ecc.length;
  const present = Uint8Array.from(rows.rows, (r) => (r ? 1 : 0));
  const offset = new Uint32Array(n + 1);
  for (let v = 0; v < n; v++) offset[v + 1] = offset[v] + (rows.rows[v]?.length ?? 0);
  const stubs = new Uint32Array(offset[n]);
  for (let v = 0; v < n; v++) if (rows.rows[v]) stubs.set(rows.rows[v]!, offset[v]);
  return { census: { ecc: rows.ecc, offset, stubs }, present };
}

// The census to draw: whole once the stage is done, else what has landed
// (the same object until more lands), or null before any row.
const soFar = new WeakMap<HopRows, { done: number; census: HopCensus; present: Uint8Array }>();
export function landedCensus(g: Graph): { census: HopCensus; present?: Uint8Array } | null {
  if (g.hopCensus) return { census: g.hopCensus };
  const rows = g.hopRows;
  if (!rows || rows.done === 0) return null;
  let s = soFar.get(rows);
  if (!s || s.done !== rows.done) {
    s = { done: rows.done, ...censusSoFar(rows) };
    soFar.set(rows, s);
  }
  return s;
}

export function censusFromRows(rows: HopRows): HopCensus {
  const n = rows.ecc.length;
  const offset = new Uint32Array(n + 1);
  for (let v = 0; v < n; v++) offset[v + 1] = offset[v] + rows.ecc[v] + 1;
  const stubs = new Uint32Array(offset[n]);
  for (let v = 0; v < n; v++) stubs.set(rows.rows[v]!, offset[v]);
  return { ecc: rows.ecc, offset, stubs };
}
