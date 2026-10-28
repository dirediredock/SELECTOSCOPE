// From an ingested dataset to the Graph the panes read, its stage fields
// still empty. The engine fills them stage by stage in workers.

import { degrees } from "../pipeline/graph";
import type { Attached, FileKind, Ingested } from "../pipeline/ingest";
import { ownLayouts } from "../pipeline/layouts";
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
    hopRows: null,
    hopCensus: null,
  };
}

// A graph already built with optional files laid over it (pipeline/ingest.ts
// attach): a shallow copy, so a new dataset for the panes, sharing every stage,
// none of which reads labels or own layouts. A file `given` replaces what the
// graph had of its kind, its refusals and warnings included; one refused
// leaves the graph's own. A 3D file brings a 2D derived from it unless the
// graph has a bespoke 2D, as a build does.
export function withFiles(base: Graph, att: Attached, given: FileKind[]): Graph {
  const own = ownLayouts(att.layouts.bespoke2d, att.layouts.bespoke3d);
  let own2d = base.layoutOwn2d;
  let own2dOrigin = base.layoutOwn2dOrigin;
  let own3d = base.layoutOwn3d;
  if (att.layouts.bespoke3d) {
    own3d = f32(own.bespoke3d);
    if (!own2d || own2dOrigin !== "bespoke") {
      own2d = f32(own.bespoke2d?.coords);
      own2dOrigin = "derived";
    }
  }
  if (own.bespoke2d?.origin === "bespoke") {
    own2d = f32(own.bespoke2d.coords);
    own2dOrigin = "bespoke";
  }
  const kept = <T extends { kind: FileKind }>(xs: T[]) => xs.filter((x) => !given.includes(x.kind));
  return {
    ...base,
    labels: att.labels ?? base.labels,
    hasLabels: att.labels !== null || base.hasLabels,
    layoutOwn2d: own2d,
    layoutOwn2dOrigin: own2dOrigin,
    layoutOwn3d: own3d,
    refused: [...kept(base.refused), ...att.refused],
    warnings: [...kept(base.warnings), ...att.warnings],
  };
}
