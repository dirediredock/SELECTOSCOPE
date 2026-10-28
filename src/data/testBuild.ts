// Tests only: a whole build in one call, every stage one after the other in
// the engine's order (FD 3D last, and only where the graph has no 3D of its
// own), for unit tests that need a small finished graph. The curated builds
// come from the app's own engine (scripts/bake.ts), never from here.

import { cores } from "../pipeline/cores";
import { hopCensus } from "../pipeline/hopcensus";
import { ingest } from "../pipeline/ingest";
import type { DatasetTexts } from "../pipeline/ingest";
import { ksnakes } from "../pipeline/ksnakes";
import { forceDirected2d, forceDirected3d } from "../pipeline/layouts";
import { componentVectors, harmonicVectors, seriate } from "../pipeline/seriations";
import { assemble } from "./assemble";
import type { Graph, OpeningView } from "./graph";

export function testBuild(texts: DatasetTexts, name: string, title: string, view: OpeningView): Graph {
  const g = assemble(ingest(texts), name, title, view);
  const c = cores(g.csr);
  g.cores = c;
  g.ksnakes = { ...c, ...ksnakes(g.csr, c) };
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
