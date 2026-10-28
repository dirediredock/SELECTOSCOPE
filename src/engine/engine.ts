// The engine: runs a build across workers and fills the graph on screen as
// each result arrives (data/graph.ts).
//
//   ingest worker    reads and cleans the files, posts the graph, exits
//   shells worker    cores, onion and the Shells orderings
//   hops workers     the stub census, in chunks of sources, over a pool
//   spectral worker  the harmonics, then the principal components
//   layout worker    FD 2D from the harmonics, posting frames as it settles
//
// Stop terminates every worker; the graph keeps what had landed.

import type { Graph as Csr } from "../pipeline/graph";
import type { DatasetTexts } from "../pipeline/ingest";
import { assemble } from "../data/assemble";
import { STAGE_NAMES, cancelLoad, data, idleStages, landed, setStage } from "../data/dataStore";
import type { Stage } from "../data/dataStore";
import { censusFromRows } from "../data/graph";
import type { Graph, OpeningView } from "../data/graph";
import type {
  HopsMessage,
  HopsRequest,
  IngestMessage,
  IngestRequest,
  LayoutMessage,
  LayoutRequest,
  ShellsMessage,
  SpectralMessage,
} from "./protocol";

let workers: Worker[] = [];

// Each worker is created where it is used, as `new Worker(new URL(...))`
// literally, which is the form the bundler finds and builds. `stages` are the
// ones it computes, so a crash fails the one it was on.
const track = (w: Worker, stages: readonly Stage[]) => {
  workers.push(w);
  w.onerror = (e) => {
    e.preventDefault();
    fail(stages, e.message);
  };
  return w;
};

// A worker crashed (a throw, or out of memory): its stage fails, and the
// build ends the way Stop ends it, keeping what had landed.
// Why: with no handler the stage would stay running, its Progress forever.
function fail(stages: readonly Stage[], message: string) {
  const stage = stages.find((k) => data.get().stages[k].status === "running") ?? stages[0]!;
  halt();
  setStage(stage, { status: "failed" });
  const error = `${STAGE_NAMES[stage]} failed: ${message || "its worker stopped"}`;
  data.set({ error });
  ended(error);
}

// The running build's onEnd, called once, wherever the build ends.
let onEnd: BuildOptions["onEnd"] | null = null;

function ended(failure: string | null) {
  const end = onEnd;
  onEnd = null;
  end?.(failure);
}

function halt() {
  workers.forEach((w) => w.terminate());
  workers = [];
  data.set((s) => ({
    running: false,
    stages: Object.fromEntries(
      Object.entries(s.stages).map(([k, v]) => [k, v.status === "running" ? { ...v, status: "pending" } : v]),
    ) as typeof s.stages,
  }));
}

export function stopBuild() {
  halt();
  ended(null);
}

// Every stage but FD 3D done: FD 3D starts, last, where the graph has no 3D
// of its own (one it does have makes FD 3D a button in NodeLink). All done:
// the build is finished.
function finishIfDone() {
  const { stages, graph } = data.get();
  const others = Object.entries(stages).filter(([k]) => k !== "fd3d");
  if (!others.every(([, s]) => s.status === "done")) return;
  if (graph && stages.fd3d.status === "pending") {
    if (!graph.layoutFd3d && !graph.layoutOwn3d) return computeFd3d();
    setStage("fd3d", { status: graph.layoutFd3d ? "done" : "off" });
  }
  if (data.get().stages.fd3d.status !== "running") {
    data.set({ running: false });
    ended(null);
  }
}

// FD 3D for the graph on screen, as a build's last stage or when NodeLink's
// 3D asks for it.
export function computeFd3d() {
  const graph = data.get().graph;
  if (!graph || graph.layoutFd3d || data.get().stages.fd3d.status === "running") return;
  data.set({ running: true });
  setStage("fd3d", { status: "running", progress: 0 });
  const w = track(new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" }), ["fd3d"]);
  w.onmessage = (e: MessageEvent<LayoutMessage>) => {
    if (data.get().graph !== graph) return w.terminate();
    const msg = e.data;
    graph.layoutFd3d = Float32Array.from(msg.coords);
    if (msg.type === "frame") setStage("fd3d", { progress: msg.pass / msg.passes });
    else {
      setStage("fd3d", { status: "done", progress: 1 });
      w.terminate();
      data.set({ running: false });
      ended(null);
    }
    landed();
  };
  w.postMessage({ type: "fd3d", graph: graph.csr, harm: graph.harmonics } satisfies LayoutRequest);
}

export interface BuildOptions {
  // The graph's name: a curated dataset's, or "user".
  name: string;
  title: string;
  // What the data store calls the dataset while it is shown (a Data row's
  // id); the name by default.
  current?: string;
  view?: OpeningView;
  // The edge list was refused: nothing was built, and the graph on screen
  // stays as it was.
  onRefused?: (reason: string) => void;
  // The graph is on screen; its stages fill in from here.
  onIngested?: (graph: Graph) => void;
  // The build ended: finished (FD 3D included), stopped, refused, or failed
  // with `failure`.
  onEnd?: (failure: string | null) => void;
}

export function startBuild(texts: DatasetTexts, opts: BuildOptions) {
  cancelLoad();
  stopBuild();
  onEnd = opts.onEnd ?? null;
  // The graph on screen keeps these if the file is refused.
  const { stages: shown, error: shownError } = data.get();
  data.set({ stages: idleStages(), error: null, running: true });
  setStage("ingest", { status: "running" });
  const w = track(new Worker(new URL("./ingest.worker.ts", import.meta.url), { type: "module" }), ["ingest"]);
  w.onmessage = (e: MessageEvent<IngestMessage>) => {
    const msg = e.data;
    if (msg.type === "error") {
      halt();
      data.set({ stages: shown, error: shownError });
      opts.onRefused?.(msg.message);
      ended(null);
      return;
    }
    const csr = msg.graph;
    const graph = assemble(msg, opts.name, opts.title, opts.view ?? null);
    data.set({ graph, current: opts.current ?? opts.name });
    opts.onIngested?.(graph);
    setStage("ingest", { status: "done" });
    runShells(graph, csr);
    runHops(graph, csr);
    runSpectral(graph, csr);
  };
  w.postMessage({ type: "build", texts } satisfies IngestRequest);
}

function runShells(graph: Graph, csr: Csr) {
  setStage("shells", { status: "running" });
  const w = track(new Worker(new URL("./shells.worker.ts", import.meta.url), { type: "module" }), ["shells"]);
  w.onmessage = (e: MessageEvent<ShellsMessage>) => {
    const msg = e.data;
    graph.cores = msg.cores;
    graph.ksnakes = { core: msg.cores.core, onion: msg.cores.onion, ...msg.ksnakes };
    setStage("shells", { status: "done" });
    w.terminate();
    landed();
    finishIfDone();
  };
  w.postMessage({ graph: csr });
}

function runHops(graph: Graph, csr: Csr) {
  const n = csr.n;
  const pool = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
  // Small chunks, so lines land steadily and every worker stays busy.
  const chunk = Math.max(8, Math.ceil(n / (pool * 16)));
  const ranges: [number, number][] = [];
  for (let from = 0; from < n; from += chunk) ranges.push([from, Math.min(n, from + chunk)]);
  const rows = (graph.hopRows = { ecc: new Uint32Array(n), rows: new Array(n), done: 0 });
  setStage("hops", { status: "running", progress: 0 });
  let next = 0;
  const feed = (w: Worker) => {
    if (next >= ranges.length) return;
    const [from, to] = ranges[next++];
    w.postMessage({ type: "range", from, to } satisfies HopsRequest);
  };
  for (let i = 0; i < Math.min(pool, ranges.length); i++) {
    const w = track(new Worker(new URL("./hops.worker.ts", import.meta.url), { type: "module" }), ["hops"]);
    w.onmessage = (e: MessageEvent<HopsMessage>) => {
      const { from, ecc, stubs } = e.data;
      let at = 0;
      for (let k = 0; k < ecc.length; k++) {
        rows.ecc[from + k] = ecc[k];
        rows.rows[from + k] = stubs.subarray(at, at + ecc[k] + 1);
        at += ecc[k] + 1;
      }
      rows.done += ecc.length;
      if (rows.done === n) {
        graph.hopCensus = censusFromRows(rows);
        setStage("hops", { status: "done", progress: 1 });
        w.terminate();
        finishIfDone();
      } else {
        setStage("hops", { progress: rows.done / n });
        feed(w);
      }
      landed();
    };
    w.postMessage({ type: "graph", graph: csr } satisfies HopsRequest);
    feed(w);
  }
}

// The harmonics, then the components; FD 2D starts as soon as the harmonics
// land.
function runSpectral(graph: Graph, csr: Csr) {
  setStage("harmonics", { status: "running" });
  setStage("components", { status: "running" });
  const w = track(new Worker(new URL("./spectral.worker.ts", import.meta.url), { type: "module" }), [
    "harmonics",
    "components",
  ]);
  w.onmessage = (e: MessageEvent<SpectralMessage>) => {
    const msg = e.data;
    graph.seriations = { ...graph.seriations, ...msg.orders };
    if (msg.type === "harmonics") {
      graph.harmonics = msg.harm;
      setStage("harmonics", { status: "done" });
      runFd2d(graph, csr, msg.harm);
    } else {
      setStage("components", { status: "done" });
      w.terminate();
    }
    landed();
    finishIfDone();
  };
  w.postMessage({ graph: csr });
}

function runFd2d(graph: Graph, csr: Csr, harm: Float64Array[]) {
  setStage("fd2d", { status: "running", progress: 0 });
  const w = track(new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" }), ["fd2d"]);
  w.onmessage = (e: MessageEvent<LayoutMessage>) => {
    const msg = e.data;
    graph.layoutFd = Float32Array.from(msg.coords);
    if (msg.type === "frame") setStage("fd2d", { progress: msg.pass / msg.passes });
    else {
      setStage("fd2d", { status: "done", progress: 1 });
      w.terminate();
      finishIfDone();
    }
    landed();
  };
  w.postMessage({ type: "fd2d", graph: csr, harm } satisfies LayoutRequest);
}
