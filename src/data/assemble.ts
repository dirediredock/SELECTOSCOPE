// From an ingested dataset to the Graph the panes read, its stage fields
// still empty; and the whole build in one call, for Node (scripts/bake.ts)
// and tests. The engine fills the same fields stage by stage in workers.

import { eigenvectorCentrality } from "../pipeline/centrality";
import { cores } from "../pipeline/cores";
import { degrees } from "../pipeline/graph";
import { hopCensus } from "../pipeline/hopcensus";
import { ingest } from "../pipeline/ingest";
import type { DatasetTexts, Ingested } from "../pipeline/ingest";
import { ksnakes } from "../pipeline/ksnakes";
import { forceDirected2d, forceDirected3d, ownLayouts } from "../pipeline/layouts";
import { SEED } from "../pipeline/randomize";
import { componentVectors, harmonicVectors, seriate } from "../pipeline/seriations";
import type { Graph, OpeningView } from "./graph";

const f32 = (x: Float64Array | null | undefined) => (x ? Float32Array.from(x) : null);

export function assemble(ing: Omit<Ingested, "graph"> & { graph: Ingested["graph"] }, name: string, title: string, view: OpeningView): Graph {
  const csr = ing.graph;
  const own = ownLayouts(ing.layouts.bespoke2d, ing.layouts.bespoke3d);
  return {
    name,
    title,
    n: csr.n,
    m: csr.m,
    seed: SEED,
    nodeId: csr.nodeId,
    edgeRow: csr.edgeRow,
    csr,
    degree: degrees(csr),
    labels: ing.labels ?? new Array<string>(csr.n).fill(""),
    hasLabels: ing.labels !== null,
    edgeSource: csr.source,
    edgeTarget: csr.target,
    report: ing.report,
    refused: ing.refused,
    warnings: ing.warnings,
    view,
    layoutFd: null,
    layoutFdOrigin: "computed",
    layoutFd3d: null,
    layoutFd3dOrigin: "computed",
    layoutOwn2d: f32(own.bespoke2d?.coords),
    layoutOwn2dOrigin: own.bespoke2d?.origin ?? "bespoke",
    layoutOwn3d: f32(own.bespoke3d),
    harmonics: null,
    seriations: {},
    cores: null,
    ksnakes: null,
    centrality: null,
    hopRows: null,
    hopCensus: null,
  };
}

// Every stage, one after the other, as the engine computes them: FD 3D last,
// and only where the graph has no 3D of its own.
export function buildNow(texts: DatasetTexts, name: string, title: string, view: OpeningView): Graph {
  const g = assemble(ingest(texts), name, title, view);
  const c = cores(g.csr);
  g.cores = c;
  g.ksnakes = { ...c, ...ksnakes(g.csr, c) };
  g.centrality = { eigenvector: eigenvectorCentrality(g.csr) };
  const hc = hopCensus(g.csr);
  const offset = new Uint32Array(g.n + 1);
  for (let v = 0; v < g.n; v++) offset[v + 1] = offset[v] + hc.ecc[v] + 1;
  g.hopCensus = { ecc: hc.ecc, offset, stubs: hc.stubs };
  const harm = harmonicVectors(g.csr);
  g.harmonics = harm;
  g.seriations = seriate(harm, componentVectors(g.csr));
  g.layoutFd = Float32Array.from(forceDirected2d(g.csr, harm));
  if (!g.layoutOwn3d) g.layoutFd3d = Float32Array.from(forceDirected3d(g.csr, harm));
  return g;
}
