// The build as JSON (format 1): what Export downloads, what `npm run bake`
// writes for the curated datasets (public/builds/), and what either loads
// back with no engine run. Columnar arrays, indexed by node_idx / edge_idx,
// snake_case on the wire; converted to the Graph's typed arrays here and
// nowhere else.

import { buildGraph } from "../pipeline/graph";
import type { Refusal } from "../pipeline/ingest";
import { ORDERINGS, SINGLETONS } from "../pipeline/ksnakes";
import type { KSnakes, Ordering, SingletonMode } from "../pipeline/ksnakes";
import { SERIATIONS } from "../pipeline/seriations";
import type { Seriation } from "../pipeline/seriations";
import type { Graph, LayoutOrigin, OpeningView } from "./graph";
import { degrees } from "../pipeline/graph";

export const FORMAT = 1;

export interface BuildJson {
  meta: {
    format: number;
    name: string;
    title: string;
    nodes: number;
    edges: number;
    view: OpeningView;
    layouts: Partial<Record<LayoutKey, LayoutOrigin>>;
    refused: Refusal[];
    warnings?: Refusal[];
  };
  nodes: { node_id: string[]; label?: string[] };
  // `row`: each edge's row in edgelist.csv, its provenance.
  edges: { source: number[]; target: number[]; row: number[] };
  layouts: Partial<Record<LayoutKey, number[]>>;
  seriations: Partial<Record<Seriation, number[]>>;
  ksnakes: {
    core: number[];
    onion: number[];
    island: number[];
    orders: Record<SingletonMode, { row: Record<Ordering, number[]> }>;
  };
  hopcensus: { ecc: number[]; stubs: number[] };
}
// Older format-1 builds also carry `centrality`, the Shells orders'
// `crossings`, and `seed`, `has_labels` and `report` in meta. Nothing reads
// them, so fromJson skips them and those files still open.

type LayoutKey = "fd_2d" | "fd_3d" | "bespoke_2d" | "bespoke_3d";

// Coordinates go out with 5 decimals, here and in Export CSVs.
export const coords = (xy: Float32Array) => Array.from(xy, (x) => Math.round(x * 1e5) / 1e5 || 0);

// A graph is exportable once every stage it needs has landed; FD 3D is
// optional (the pane computes it on demand).
export function exportable(g: Graph): boolean {
  // A graph of two or three nodes has fewer waves than three.
  return !!(g.layoutFd && g.cores && g.ksnakes && g.hopCensus && g.seriations.harm1 && g.seriations.pc1);
}

export function toJson(g: Graph): BuildJson {
  if (!exportable(g)) throw new Error("the build isn't finished");
  const layouts: BuildJson["layouts"] = {};
  const origins: BuildJson["meta"]["layouts"] = {};
  const put = (key: LayoutKey, xy: Float32Array | null, origin: LayoutOrigin) => {
    if (!xy) return;
    layouts[key] = coords(xy);
    origins[key] = origin;
  };
  put("fd_2d", g.layoutFd, g.layoutFdOrigin);
  put("fd_3d", g.layoutFd3d, g.layoutFd3dOrigin);
  put("bespoke_2d", g.layoutOwn2d, g.layoutOwn2dOrigin);
  put("bespoke_3d", g.layoutOwn3d, "bespoke");
  const ks = g.ksnakes!;
  return {
    meta: {
      format: FORMAT,
      name: g.name,
      title: g.title,
      nodes: g.n,
      edges: g.m,
      view: g.view,
      layouts: origins,
      refused: g.refused,
      ...(g.warnings.length ? { warnings: g.warnings } : {}),
    },
    nodes: { node_id: g.nodeId, ...(g.hasLabels ? { label: g.labels } : {}) },
    edges: { source: Array.from(g.edgeSource), target: Array.from(g.edgeTarget), row: Array.from(g.edgeRow) },
    layouts,
    seriations: Object.fromEntries(SERIATIONS.filter((s) => g.seriations[s]).map((s) => [s, Array.from(g.seriations[s]!)])),
    ksnakes: {
      core: Array.from(ks.core),
      onion: Array.from(ks.onion),
      island: Array.from(ks.island),
      orders: Object.fromEntries(
        SINGLETONS.map((mode) => [
          mode,
          { row: Object.fromEntries(ORDERINGS.map((o) => [o, Array.from(ks.orders[mode].row[o])])) },
        ]),
      ) as BuildJson["ksnakes"]["orders"],
    },
    hopcensus: { ecc: Array.from(g.hopCensus!.ecc), stubs: Array.from(g.hopCensus!.stubs) },
  };
}

export function fromJson(json: BuildJson): Graph {
  const { meta } = json;
  if (meta?.format !== FORMAT) throw new Error(`not a build of format ${FORMAT}`);
  const source = Uint32Array.from(json.edges.source);
  const target = Uint32Array.from(json.edges.target);
  const csr = buildGraph(json.nodes.node_id, Uint32Array.from(json.edges.row), source, target);
  const layout = (key: LayoutKey) => (json.layouts[key] ? Float32Array.from(json.layouts[key]!) : null);
  const ks = json.ksnakes;
  const core = Uint32Array.from(ks.core);
  const onion = Uint32Array.from(ks.onion);
  const ecc = Uint32Array.from(json.hopcensus.ecc);
  const offset = new Uint32Array(meta.nodes + 1);
  for (let v = 0; v < meta.nodes; v++) offset[v + 1] = offset[v] + ecc[v] + 1;
  if (offset[meta.nodes] !== json.hopcensus.stubs.length) throw new Error("Hops: entries don't match the eccentricities");
  return {
    name: meta.name,
    title: meta.title,
    n: meta.nodes,
    m: meta.edges,
    nodeId: json.nodes.node_id,
    edgeRow: csr.edgeRow,
    csr,
    degree: degrees(csr),
    labels: json.nodes.label ?? new Array<string>(meta.nodes).fill(""),
    hasLabels: !!json.nodes.label,
    edgeSource: source,
    edgeTarget: target,
    report: null,
    refused: meta.refused,
    warnings: meta.warnings ?? [],
    view: meta.view,
    layoutFd: layout("fd_2d"),
    layoutFdOrigin: meta.layouts.fd_2d ?? "computed",
    layoutFd3d: layout("fd_3d"),
    layoutFd3dOrigin: meta.layouts.fd_3d ?? "computed",
    layoutOwn2d: layout("bespoke_2d"),
    layoutOwn2dOrigin: meta.layouts.bespoke_2d ?? "bespoke",
    layoutOwn3d: layout("bespoke_3d"),
    harmonics: null,
    seriations: Object.fromEntries(Object.entries(json.seriations).map(([k, v]) => [k, Uint32Array.from(v!)])),
    cores: { core, onion },
    ksnakes: {
      core,
      onion,
      island: Uint32Array.from(ks.island),
      orders: Object.fromEntries(
        SINGLETONS.map((mode) => [
          mode,
          { row: Object.fromEntries(ORDERINGS.map((o) => [o, Uint32Array.from(ks.orders[mode].row[o])])) },
        ]),
      ) as KSnakes["orders"],
    },
    hopRows: null,
    hopCensus: { ecc, offset, stubs: Uint32Array.from(json.hopcensus.stubs) },
  };
}

export function stringify(g: Graph): string {
  return JSON.stringify(toJson(g));
}
