// The graph on screen and the build that fills it, stage by stage
// (engine/engine.ts). Each pane draws from whatever has landed and shows its
// stage's progress while its own result is missing.

import { createStore } from "../state/createStore";
import { csvFiles } from "./csvExport";
import { exportable, fromJson, stringify } from "./format";
import type { BuildJson } from "./format";
import type { Graph, OpeningView } from "./graph";
import { zip } from "./zip";

export const STAGES = ["ingest", "shells", "hops", "harmonics", "components", "fd2d", "fd3d"] as const;
export type Stage = (typeof STAGES)[number];

// What each stage is called while it runs: a pane's subtitle and progress.
export const STAGE_NAMES: Record<Stage, string> = {
  ingest: "Reading",
  shells: "Shells",
  hops: "Hops",
  harmonics: "Harmonics",
  components: "Components",
  fd2d: "Force layout",
  fd3d: "3D layout",
};

export interface StageState {
  // "off": not part of this build (FD 3D where the dataset has its own 3D,
  // until asked for).
  status: "pending" | "running" | "done" | "failed" | "off";
  // 0–1, or null when its share can't be known.
  progress: number | null;
}

// A curated dataset in the list (public/builds/index.json, in manifest order).
export interface DatasetEntry {
  name: string;
  title: string;
  // The Data pane's section; a group's entries are contiguous.
  group: string;
  view: OpeningView;
  nodes: number;
  edges: number;
  has_labels: boolean;
}

export interface DatasetState {
  index: DatasetEntry[] | null;
  // The dataset on screen: a curated name, or the user's build.
  current: string | null;
  // A pending or failed load, kept apart so a failure can be retried.
  requested: string | null;
  loading: boolean;
  // The share of the pending fetch received (0–1), or null while its size is
  // unknown; meaningful only while loading.
  progress: number | null;
  loadError: string | null;
  graph: Graph | null;
  // Bumped whenever a stage fills more of the graph.
  revision: number;
  stages: Record<Stage, StageState>;
  running: boolean;
  // The build was refused, or one of its stages failed.
  error: string | null;
}

export const idleStages = (): Record<Stage, StageState> =>
  Object.fromEntries(STAGES.map((s) => [s, { status: "pending", progress: null }])) as Record<Stage, StageState>;

export const datasetStore = createStore<DatasetState>({
  index: null,
  current: null,
  requested: null,
  loading: false,
  progress: null,
  loadError: null,
  graph: null,
  revision: 0,
  stages: idleStages(),
  running: false,
  error: null,
});

const doneStages = (g: Graph) =>
  Object.fromEntries(
    STAGES.map((s) => [s, { status: s === "fd3d" && !g.layoutFd3d ? "off" : "done", progress: 1 }]),
  ) as Record<Stage, StageState>;

// A finished graph on screen at once: a curated build or an opened file.
// Like every new dataset, a fresh start for every pane.
export function showGraph(graph: Graph, current: string) {
  datasetStore.set({ graph, current, stages: doneStages(graph), running: false, error: null, requested: null, loading: false, loadError: null });
}

let latest = 0;

// A curated dataset's build. The panes go empty while it downloads, as on
// opening; a newer pick wins over an older one still in flight.
export async function loadDataset(name: string, stop: () => void) {
  const state = datasetStore.get();
  if (state.loading && name === state.requested) return;
  const token = ++latest;
  if (state.current === name && state.graph) {
    datasetStore.set({ requested: null, loading: false, loadError: null });
    return;
  }
  stop();
  datasetStore.set({ graph: null, current: null, error: null, requested: name, loading: true, progress: 0, loadError: null });
  try {
    const res = await fetch(`builds/${name}.json`);
    if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
    const text = await readBody(res, (share) => {
      const p = share === null ? null : Math.floor(share * 100) / 100;
      if (token === latest && p !== datasetStore.get().progress) datasetStore.set({ progress: p });
    });
    const graph = fromJson(JSON.parse(text) as BuildJson);
    if (token !== latest) return;
    showGraph(graph, name);
  } catch (e) {
    if (token === latest) datasetStore.set({ loading: false, loadError: String(e) });
  }
}

// A user build or an opened file: a newer pick than any curated build still
// in flight, which then never lands. Returns the pick's token.
export function cancelLoad(): number {
  datasetStore.set({ requested: null, loading: false, loadError: null });
  return ++latest;
}

// The datasets the app may open on: those whose Matrix sweep (sweep.ts's
// showcase) lights every pane most strikingly. The Data list shows them all.
const SHOWCASE = new Set([
  "fullerene_structures_C3840",
  "icosphere_6252",
  "lattice_monotiles_5992",
  "lattice_penrose_5981",
  "fibonacci_sunflower",
  "spot",
  "stanford_bunny",
  "sierpinski_triangle_3282",
  "indo_european",
  "word_ladder",
  "wiki_science",
  "thinkers",
  "mathematicians",
  "programming_languages",
  "music_genres",
  "jazz_musicians",
  "human_connectome",
  "groel_ring",
  "celegans_male_gap_junction",
  "celegans_hermaphrodite_gap_junction",
]);

// The app opens on a random showcase dataset, so no one graph becomes the
// habitual view; unless the user picked something first.
export async function initData(stop: () => void) {
  const token = latest;
  datasetStore.set({ loading: true, progress: null, loadError: null });
  try {
    const res = await fetch("builds/index.json");
    if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`);
    const { datasets } = (await res.json()) as { datasets: DatasetEntry[] };
    datasetStore.set({ index: datasets, loading: false });
    if (token !== latest) return;
    const shown = datasets.filter((d) => SHOWCASE.has(d.name));
    const pool = shown.length ? shown : datasets;
    await loadDataset(pool[Math.floor(Math.random() * pool.length)].name, stop);
  } catch (e) {
    datasetStore.set({ loading: false, loadError: String(e) });
  }
}

// Hands the browser a file to save.
function download(blob: Blob, fileName: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

// What a saved file is called: a user's graph goes by its title.
const fileBase = (g: Graph) => (g.name === "user" ? g.title || "build" : g.name);

// The graph on screen as a build file to save, once its build is finished.
export function exportJson() {
  const g = datasetStore.get().graph;
  if (!g) return;
  download(new Blob([stringify(g)], { type: "application/json" }), `${fileBase(g)}.json`);
}

// The graph on screen as a zip of the CSVs Build from CSV reads
// (csvExport.ts), once its build is finished.
export function exportCsvs() {
  const g = datasetStore.get().graph;
  if (!g || !exportable(g)) return;
  download(new Blob([zip(csvFiles(g))], { type: "application/zip" }), `${fileBase(g)}.zip`);
}

// A file that isn't a build, with a short reason.
export class BuildFileError extends Error {}

// A build file saved by Export, read as a user's graph. Reading it shows
// nothing: showing it (showGraph, after cancelLoad) is the caller's.
export async function readBuildFile(file: File): Promise<Graph> {
  let json: BuildJson;
  try {
    json = JSON.parse(await file.text()) as BuildJson;
  } catch {
    throw new BuildFileError("not JSON");
  }
  let graph: Graph;
  try {
    graph = fromJson(json);
  } catch (e) {
    // A missing field reads as a TypeError, whose wording means nothing here.
    throw new BuildFileError(e instanceof Error && !(e instanceof TypeError) ? e.message : "not a build file");
  }
  return { ...graph, name: "user" };
}

// The stage that failed in the build on screen, in a few words.
export function failedStage(s: DatasetState): string | null {
  const stage = STAGES.find((k) => s.stages[k].status === "failed");
  return stage ? `${STAGE_NAMES[stage]} failed` : null;
}

export function setStage(stage: Stage, patch: Partial<StageState>) {
  datasetStore.set((s) => ({ stages: { ...s.stages, [stage]: { ...s.stages[stage], ...patch } } }));
}

// The graph's stage fields changed in place.
export function landed() {
  datasetStore.set((s) => ({ revision: s.revision + 1 }));
}

// The first of `stages` not yet done: what a pane waits on. Its name and
// progress are read apart, so each is a plain value a component can pick.
export function waitStage(s: DatasetState, stages: readonly Stage[]): Stage | null {
  return stages.find((k) => s.stages[k].status !== "done" && s.stages[k].status !== "off") ?? null;
}

export function stageShare(s: DatasetState, stage: Stage | null): number | null {
  if (!stage) return null;
  const st = s.stages[stage];
  return st.status === "running" ? st.progress : null;
}

// The share of the body received so far, or null when the size can't be
// known: no Content-Length, or a compressed body, whose length counts the
// compressed bytes while the stream yields more than that.
export type OnProgress = (share: number | null) => void;

export async function readBody(res: Response, onProgress?: OnProgress): Promise<string> {
  if (!res.body || !onProgress) return res.text();
  const length = Number(res.headers.get("content-length"));
  let total = length > 0 && !res.headers.get("content-encoding") ? length : null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  onProgress(total === null ? null : 0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (total !== null && received > total) total = null;
    onProgress(total === null ? null : received / total);
  }
  return text + decoder.decode();
}
