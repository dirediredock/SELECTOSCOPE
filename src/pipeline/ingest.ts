// From a dataset's CSV texts to the randomized Graph, its labels and layouts.
//
// The edge list is cleaned, and every change is counted in the report:
// direction is ignored, self-loops are dropped, repeated edges are merged
// (the first row is kept), and only the largest connected component stays.
// Edges have no ids of their own: each keeps its row in the file as
// provenance.
//
// Each optional file is joined on node_id and refused whole, with counts,
// when its ids don't match the edge list: an id the edge list never names, a
// repeated id, or (in a layout) a kept node with no row. Labels may cover
// only some nodes: the rest are unlabelled, and a warning counts them. Rows
// for nodes the cleaning dropped are skipped, not counted. Matching ids
// across files is the user's responsibility; nothing is guessed.

import { CsvError, column, parseCsv } from "./csv";
import type { Table } from "./csv";
import { buildGraph } from "./graph";
import type { Graph } from "./graph";
import { SEED, permutation, rng } from "./randomize";

export type FileKind = "edgelist" | "labels" | "layout2d" | "layout3d";
export type LayoutKind = "bespoke2d" | "bespoke3d";

// Each file's name in a dataset folder (public/datasets/). Never shown in
// the app, where a user's file goes by its own name.
export const FILE_NAMES: Record<FileKind, string> = {
  edgelist: "edgelist.csv",
  labels: "labels.csv",
  layout2d: "layout_2d.csv",
  layout3d: "layout_3d.csv",
};

const LAYOUT_FILES: ["layout2d" | "layout3d", LayoutKind, number][] = [
  ["layout2d", "bespoke2d", 2],
  ["layout3d", "bespoke3d", 3],
];

// The tool's scale is about 5k nodes and 50k edges; past these, a build would
// stall the tab rather than show anything.
export const MAX_NODES = 10_000;
export const MAX_EDGES = 100_000;

export type DatasetTexts = { edgelist: string } & Partial<Record<FileKind, string>>;

export interface CleanReport {
  rows: number;
  selfLoops: number;
  repeated: number;
  // Connected components after the loops and repeats are gone; only the
  // largest is kept.
  components: number;
  droppedNodes: number;
  droppedEdges: number;
}

export interface Refusal {
  kind: FileKind;
  reason: string;
}

// A file that loaded, with something the user should know.
export type Warning = Refusal;

export interface Ingested {
  graph: Graph;
  labels: string[] | null; // by node_idx
  layouts: Partial<Record<LayoutKind, Float64Array>>; // flattened, rows by node_idx
  report: CleanReport;
  refused: Refusal[];
  warnings: Warning[];
}

// The edge list itself can't be used. Messages name no file: the app names
// it as the user knows it.
export class IngestError extends Error {}

const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? "" : "s"}`;

function parse(text: string): Table {
  try {
    return parseCsv(text);
  } catch (e) {
    if (e instanceof CsvError) throw new IngestError(e.message);
    throw e;
  }
}

export function ingest(texts: DatasetTexts): Ingested {
  const table = parse(texts.edgelist);
  const src = column(table, "source");
  const dst = column(table, "target");
  if (!src || !dst) throw new IngestError("needs source and target columns");
  const rows = table.rows.length;
  if (rows === 0) throw new IngestError("no edges");

  // Nodes by first appearance, source then target per row, so the
  // ingested order follows the file (until randomize replaces it).
  const rank = new Map<string, number>();
  const named: string[] = [];
  const at = (raw: string, row: number) => {
    const id = raw.trim();
    if (id === "") throw new IngestError(`row ${row + 2} has an empty endpoint`);
    let r = rank.get(id);
    if (r === undefined) {
      r = named.length;
      rank.set(id, r);
      named.push(id);
    }
    return r;
  };
  let selfLoops = 0;
  let repeated = 0;
  const pairs = new Set<number>();
  const keptRows: number[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < rows; i++) {
    const u = at(src[i], i);
    const v = at(dst[i], i);
    if (u === v) {
      selfLoops++;
      continue;
    }
    const lo = Math.min(u, v);
    const hi = Math.max(u, v);
    const key = lo * 0x100000000 + hi; // exact while there are under 2^21 nodes
    if (pairs.has(key)) {
      repeated++;
      continue;
    }
    pairs.add(key);
    keptRows.push(i);
    a.push(u);
    b.push(v);
  }

  // Components by union-find; the largest stays, a tie going to the one
  // named first in the file.
  const parent = new Int32Array(named.length).map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let e = 0; e < a.length; e++) {
    const ra = find(a[e]);
    const rb = find(b[e]);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  const size = new Map<number, number>();
  const inEdge = new Uint8Array(named.length);
  for (let e = 0; e < a.length; e++) inEdge[a[e]] = inEdge[b[e]] = 1;
  for (let r = 0; r < named.length; r++) {
    if (!inEdge[r]) continue; // a node seen only in self-loops has no edge left
    const root = find(r);
    size.set(root, (size.get(root) ?? 0) + 1);
  }
  if (size.size === 0) throw new IngestError("no edges besides self-loops");
  let best = -1;
  let bestSize = 0;
  for (const [root, k] of size) {
    if (k > bestSize || (k === bestSize && root < best)) {
      best = root;
      bestSize = k;
    }
  }

  const keep = (r: number) => inEdge[r] === 1 && find(r) === best;
  const keptNodes = named.filter((_, r) => keep(r));
  const n = keptNodes.length;
  const edgeKeep: number[] = [];
  for (let e = 0; e < a.length; e++) if (keep(a[e])) edgeKeep.push(e);
  const m = edgeKeep.length;
  if (n > MAX_NODES || m > MAX_EDGES) {
    throw new IngestError(`the graph has ${n} nodes and ${m} edges; the limit is ${MAX_NODES} nodes and ${MAX_EDGES} edges`);
  }

  const next = rng(SEED);
  const nodePerm = permutation(next, n); // kept rank -> node_idx
  const edgePerm = permutation(next, m); // kept rank -> edge_idx
  const idxOfRank = new Int32Array(named.length).fill(-1);
  const nodeId = new Array<string>(n);
  keptNodes.forEach((id, k) => {
    idxOfRank[rank.get(id)!] = nodePerm[k];
    nodeId[nodePerm[k]] = id;
  });
  const source = new Uint32Array(m);
  const target = new Uint32Array(m);
  const edgeRow = new Uint32Array(m);
  edgeKeep.forEach((e, k) => {
    const i = edgePerm[k];
    const u = idxOfRank[a[e]];
    const v = idxOfRank[b[e]];
    // Oriented by the random ids, so the file's orientation doesn't leak.
    source[i] = Math.min(u, v);
    target[i] = Math.max(u, v);
    edgeRow[i] = keptRows[e];
  });

  const graph = buildGraph(nodeId, edgeRow, source, target);
  const report: CleanReport = {
    rows,
    selfLoops,
    repeated,
    components: size.size,
    droppedNodes: named.length - n,
    droppedEdges: a.length - m,
  };

  const idxOf = (id: string) => {
    const r = rank.get(id);
    return r === undefined ? undefined : idxOfRank[r];
  };
  return { graph, report, ...readOptional(texts, n, idxOf) };
}

export type OptionalTexts = Partial<Record<Exclude<FileKind, "edgelist">, string>>;

export type Attached = Pick<Ingested, "labels" | "layouts" | "refused" | "warnings">;

// Optional files joined onto a graph already built (a curated build or an
// opened file), by its nodes' ids as the CSVs wrote them. A row for a node
// the cleaning dropped reads as an id the edge list never names: the graph
// no longer knows it.
export function attach(nodeId: string[], texts: OptionalTexts): Attached {
  const at = new Map(nodeId.map((id, v) => [id, v]));
  return readOptional(texts, nodeId.length, (id) => at.get(id));
}

// The labels and layouts, each joined on node_id or refused.
function readOptional(texts: OptionalTexts, n: number, idxOf: (id: string) => number | undefined): Attached {
  const refused: Refusal[] = [];
  const warnings: Warning[] = [];
  let labels: string[] | null = null;
  if (texts.labels !== undefined) {
    const out = join("labels", texts.labels, ["label"], n, idxOf, refused, true);
    if (out) {
      // A loop, not filter or map: the rows missing are holes, which they skip.
      labels = new Array<string>(n);
      let missing = 0;
      for (let v = 0; v < n; v++) {
        labels[v] = out[v]?.[0] ?? "";
        if (!out[v]) missing++;
      }
      if (missing) warnings.push({ kind: "labels", reason: `${plural(missing, "node")} with no label` });
    }
  }
  const layouts: Ingested["layouts"] = {};
  for (const [kind, layout, dim] of LAYOUT_FILES) {
    const text = texts[kind];
    if (text === undefined) continue;
    const out = join(kind, text, ["x", "y", "z"].slice(0, dim), n, idxOf, refused);
    if (!out) continue;
    const flat = new Float64Array(n * dim);
    let bad = 0;
    out.forEach((row, v) =>
      row!.forEach((cell, k) => {
        const x = cell.trim() === "" ? NaN : Number(cell);
        if (!Number.isFinite(x)) bad++;
        flat[v * dim + k] = x;
      }),
    );
    if (bad) refused.push({ kind, reason: `${plural(bad, "coordinate")} not a number` });
    else layouts[layout] = flat;
  }
  return { labels, layouts, refused, warnings };
}

// The file's value columns per node_idx, or null when refused. With
// `partial`, a node with no row is undefined rather than a refusal.
function join(
  kind: FileKind,
  text: string,
  columns: string[],
  n: number,
  idxOf: (id: string) => number | undefined,
  refused: Refusal[],
  partial = false,
): (string[] | undefined)[] | null {
  let table: Table;
  try {
    table = parseCsv(text);
  } catch (e) {
    if (!(e instanceof CsvError)) throw e;
    refused.push({ kind, reason: e.message });
    return null;
  }
  const ids = column(table, "node_id");
  const values = columns.map((c) => column(table, c));
  if (!ids || values.some((v) => !v)) {
    refused.push({ kind, reason: `needs the columns node_id,${columns.join(",")}` });
    return null;
  }
  const out = new Array<string[] | undefined>(n);
  let unknown = 0;
  let repeats = 0;
  ids.forEach((raw, i) => {
    const id = raw.trim();
    const v = idxOf(id);
    if (v === undefined) {
      unknown++;
      return;
    }
    if (v < 0) return; // dropped by the cleaning
    if (out[v]) {
      repeats++;
      return;
    }
    out[v] = values.map((col) => col![i]);
  });
  let missing = 0;
  for (let v = 0; v < n; v++) if (!out[v]) missing++;
  const problems = [];
  if (unknown) problems.push(`${plural(unknown, "node_id")} not in the edge list`);
  if (repeats) problems.push(`${plural(repeats, "repeated node_id")}`);
  if (missing && !partial) problems.push(`${plural(missing, "node")} with no row`);
  if (problems.length) {
    refused.push({ kind, reason: problems.join(", ") });
    return null;
  }
  return out;
}
