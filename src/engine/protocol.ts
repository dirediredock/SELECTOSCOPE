// Messages between the engine (engine.ts, main thread) and its workers.

import type { Cores } from "../pipeline/cores";
import type { KSnakes } from "../pipeline/ksnakes";
import type { Graph } from "../pipeline/graph";
import type { Seriation } from "../pipeline/seriations";
import type { CleanReport, DatasetTexts, LayoutKind, Refusal, Warning } from "../pipeline/ingest";

export type CoreRequest = { type: "build"; texts: DatasetTexts };

export type CoreMessage =
  | {
      type: "ingested";
      graph: Graph;
      labels: string[] | null;
      layouts: Partial<Record<LayoutKind, Float64Array>>;
      report: CleanReport;
      refused: Refusal[];
      warnings: Warning[];
    }
  | { type: "cores"; cores: Cores; ksnakes: KSnakes }
  | { type: "centrality"; centrality: Float64Array }
  | { type: "error"; message: string };

export type HopsRequest = { type: "graph"; graph: Graph } | { type: "range"; from: number; to: number };

// The sources from..to-1: their eccentricities and their census rows,
// concatenated.
export type HopsMessage = { type: "rows"; from: number; ecc: Uint32Array; stubs: Uint32Array };

// FD 2D from the harmonics; FD 3D from them too, computed first when the
// graph came from a build, which doesn't keep them.
export type LayoutRequest = { type: "fd2d" | "fd3d"; graph: Graph; harm: Float64Array[] | null };

export type LayoutMessage =
  | { type: "frame"; coords: Float64Array; pass: number; passes: number }
  | { type: "done"; coords: Float64Array };

export type SpectralMessage =
  | { type: "harmonics"; harm: Float64Array[]; orders: Partial<Record<Seriation, Uint32Array>> }
  | { type: "components"; orders: Partial<Record<Seriation, Uint32Array>> };
