// The user's own datasets: the Data pane's Uploaded rows, each built from
// CSVs or opened from a build file, and the drafts + New gathers: the CSV
// draft (an edge list and its name) and the JSON draft (a build file, read
// on pick, and its name). They last for the session only, and the files never leave the
// browser; a build hands them to the engine (engine/engine.ts).
//
// The CSV draft is a row in waiting: once its edge list is read it lists
// under Uploaded with the same id, takes over the strip, and a fresh draft
// starts. Why one id: a row built again from new files stays the same row.

import { startBuild as runEngine, stopBuild as stopEngine } from "../engine/engine";
import type { DatasetTexts } from "../pipeline/ingest";
import { BuildFileError, cancelLoad, data, readBuildFile, showGraph } from "../data/dataStore";
import { exportable } from "../data/format";
import type { Graph } from "../data/graph";
import { createStore } from "./createStore";
import { setUpload, ui } from "./uiStore";

export type FileKind = "edgelist" | "labels" | "layout3d" | "layout2d";

export const OPTIONAL_KINDS = ["labels", "layout2d", "layout3d"] as const;

export interface UserFile {
  fileName: string;
  text: string;
}

export interface UserDataset {
  // What the data store calls it while it is shown (data.current).
  id: string;
  // Its title. It follows the edge list's file name until the user edits it.
  name: string;
  nameEdited: boolean;
  // All null for a dataset opened from a build file.
  files: Record<FileKind, UserFile | null>;
  // Bumped on every file change, so a build knows which files it read.
  version: number;
  // The files its graph was read from; the files whose edge list was
  // refused, and why.
  builtVersion: number | null;
  failedVersion: number | null;
  refusal: string | null;
  // The stage that failed in its last build, if one did.
  failure: string | null;
  origin: "csv" | "json";
  // Listed as a row once it has one.
  graph: Graph | null;
}

// A build file picked under + New, read but not yet added.
export interface JsonDraft {
  fileName: string;
  graph: Graph;
}

export interface UserDataState {
  // Newest first, the draft among them, unlisted until it has a graph.
  datasets: UserDataset[];
  draft: string;
  // The dataset whose build is running.
  building: string | null;
  // The build file picked, and why the last one picked couldn't be read.
  jsonDraft: JsonDraft | null;
  jsonRefusal: { fileName: string; reason: string } | null;
  // The JSON draft's name. It follows the build's title (or else its file
  // name) until the user edits it.
  jsonName: string;
  jsonNameEdited: boolean;
}

const NO_FILES: Record<FileKind, UserFile | null> = { edgelist: null, labels: null, layout3d: null, layout2d: null };

let made = 0;

const fresh = (origin: UserDataset["origin"]): UserDataset => ({
  id: `user:${++made}`,
  name: "",
  nameEdited: false,
  files: NO_FILES,
  version: 0,
  builtVersion: null,
  failedVersion: null,
  refusal: null,
  failure: null,
  origin,
  graph: null,
});

const firstDraft = fresh("csv");

export const userData = createStore<UserDataState>({
  datasets: [firstDraft],
  draft: firstDraft.id,
  building: null,
  jsonDraft: null,
  jsonRefusal: null,
  jsonName: "",
  jsonNameEdited: false,
});

export const datasetOf = (s: UserDataState, id: string | null): UserDataset | null =>
  s.datasets.find((d) => d.id === id) ?? null;

export const draftOf = (s: UserDataState): UserDataset => datasetOf(s, s.draft)!;

// A file the dataset brought and its graph refused.
export const fileRefused = (d: UserDataset, kind: FileKind) =>
  kind === "edgelist"
    ? d.failedVersion === d.version
    : d.builtVersion === d.version && !!d.graph?.refused.some((r) => r.kind === kind);

// Something stopped this dataset loading: a refused file or a failed stage.
export const datasetAlert = (d: UserDataset) =>
  d.failedVersion === d.version || !!d.failure || !!d.graph?.refused.length;

function update(id: string, patch: Partial<UserDataset>) {
  userData.set((s) => ({ datasets: s.datasets.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}

// The newest row lists first.
function toFront(id: string) {
  userData.set((s) => {
    const d = datasetOf(s, id)!;
    return { datasets: [d, ...s.datasets.filter((x) => x !== d)] };
  });
}

function startDraft() {
  const d = fresh("csv");
  userData.set((s) => ({ datasets: [d, ...s.datasets], draft: d.id }));
}

const baseName = (fileName: string) => fileName.replace(/\.(csv|json)$/i, "");

// A file picked or removed. `rebuild`: from a row's Change tray or a pane,
// which builds the row again at once; the draft waits for Build.
async function setFile(id: string, kind: FileKind, file: File | null, rebuild: boolean) {
  const text = file ? await file.text() : "";
  const d = datasetOf(userData.get(), id);
  if (!d) return; // removed while the file was read
  update(id, {
    files: { ...d.files, [kind]: file ? { fileName: file.name, text } : null },
    version: d.version + 1,
  });
  if (kind === "edgelist" && file && !d.nameEdited) rename(id, baseName(file.name), false);
  if (rebuild) buildDataset(id);
}

// The edge list carries the others, so it is only ever replaced, keeping them.
export const addFile = (id: string, kind: FileKind, file: File, rebuild: boolean) => setFile(id, kind, file, rebuild);

export const removeFile = (id: string, kind: Exclude<FileKind, "edgelist">, rebuild: boolean) =>
  setFile(id, kind, null, rebuild);

// The graph's title follows, in place. Why: one Graph object stands for a
// dataset, and a new one would read as a new dataset.
function rename(id: string, name: string, nameEdited: boolean) {
  update(id, { name, nameEdited });
  const g = datasetOf(userData.get(), id)?.graph;
  if (g) g.title = name;
}

export function setName(id: string, name: string) {
  rename(id, name, true);
}

// An emptied name is no name: it goes back to the edge list's file name.
export function commitName(id: string) {
  const d = datasetOf(userData.get(), id);
  if (!d || d.name.trim() !== "") return;
  rename(id, d.files.edgelist ? baseName(d.files.edgelist.fileName) : "", false);
}

// Esc: the name as it was when the field took focus.
export function restoreName(id: string, name: string, nameEdited: boolean) {
  rename(id, name, nameEdited);
}

export type BuildState = "idle" | "running" | "done" | "stale" | "failed";

// What Build's next click does: build, stop, nothing (built from these very
// files), build again, or nothing until a file changes (the edge list was
// refused). A build cut short builds again.
export function buildState(d: UserDataset, building: boolean): BuildState {
  if (building) return "running";
  if (!d.files.edgelist) return "idle";
  if (d.failedVersion === d.version) return "failed";
  if (d.builtVersion === null) return "idle";
  if (d.builtVersion !== d.version) return "stale";
  return d.graph && exportable(d.graph) ? "done" : "idle";
}

function textsOf(d: UserDataset): DatasetTexts | null {
  if (!d.files.edgelist) return null;
  const texts: DatasetTexts = { edgelist: d.files.edgelist.text };
  for (const kind of OPTIONAL_KINDS) {
    const f = d.files[kind];
    if (f) texts[kind] = f.text;
  }
  return texts;
}

// Builds the dataset from its files, on screen. It lists once its edge list
// is read; a refused edge list leaves the graph on screen as it was.
export function buildDataset(id: string) {
  const d = datasetOf(userData.get(), id);
  const texts = d && textsOf(d);
  if (!d || !texts) return;
  const version = d.version;
  let ingested = false;
  runEngine(texts, {
    name: "user",
    title: d.name,
    current: id,
    onRefused: (reason) => update(id, { failedVersion: version, refusal: reason }),
    onIngested: (graph) => {
      ingested = true;
      const before = datasetOf(userData.get(), id);
      if (!before) return;
      // Renamed while its files were read.
      graph.title = before.name;
      update(id, { graph, builtVersion: version, refusal: null, failure: null });
      if (!before.graph) toFront(id);
      if (id === userData.get().draft) handOver();
    },
    onEnd: (failure) => ended(id, ingested, failure),
  });
  // After the engine has ended the build before it.
  userData.set({ building: id });
}

export function buildDraft() {
  buildDataset(userData.get().draft);
}

// The draft's edge list is read: it is a row now, + New starts afresh, and
// a strip still on + New moves to the row, whose strip carries Stop while
// the build runs on. A refused edge list never gets here: it stays the
// draft, with its reason, to change and add again.
function handOver() {
  startDraft();
  if (ui.get().upload === "csv") setUpload(null);
}

function ended(id: string, ingested: boolean, failure: string | null) {
  if (userData.get().building === id) userData.set({ building: null });
  if (ingested && datasetOf(userData.get(), id)) update(id, { failure });
}

// An Uploaded row clicked: its graph again, as it was; or, if its build was
// cut short, built again from its files.
export function pickRow(id: string) {
  setUpload(null);
  const s = userData.get();
  const d = datasetOf(s, id);
  if (!d?.graph || s.building === id) return;
  if (!exportable(d.graph)) return buildDataset(id);
  if (data.get().current === id) return;
  stopEngine();
  cancelLoad();
  showGraph(d.graph, id);
}

// A build file saved by Export, picked under + New: read at once, so one
// that isn't a build is refused before Add. Its name follows the build's
// title unless the user has typed one.
export async function pickJson(file: File) {
  let graph: Graph;
  try {
    graph = await readBuildFile(file);
  } catch (e) {
    userData.set({ jsonDraft: null, jsonRefusal: { fileName: file.name, reason: e instanceof BuildFileError ? e.message : String(e) } });
    return;
  }
  const s = userData.get();
  userData.set({
    jsonDraft: { fileName: file.name, graph },
    jsonRefusal: null,
    jsonName: s.jsonNameEdited ? s.jsonName : graph.title || baseName(file.name),
  });
}

export function setJsonName(name: string) {
  userData.set({ jsonName: name, jsonNameEdited: true });
}

// An emptied name is no name: it goes back to the build's own.
export function commitJsonName() {
  const s = userData.get();
  if (s.jsonName.trim() !== "") return;
  const g = s.jsonDraft;
  userData.set({ jsonName: g ? g.graph.title || baseName(g.fileName) : "", jsonNameEdited: false });
}

export function restoreJsonName(name: string, nameEdited: boolean) {
  userData.set({ jsonName: name, jsonNameEdited: nameEdited });
}

// Add: the picked build file, opened as a new row with no engine run, and
// + New starts afresh.
export function addJson() {
  const s = userData.get();
  if (!s.jsonDraft) return;
  const { graph, fileName } = s.jsonDraft;
  graph.title = s.jsonName.trim() || graph.title || baseName(fileName);
  stopEngine();
  cancelLoad();
  const d: UserDataset = { ...fresh("json"), name: graph.title, graph };
  userData.set((st) => ({
    datasets: [d, ...st.datasets],
    jsonDraft: null,
    jsonRefusal: null,
    jsonName: "",
    jsonNameEdited: false,
  }));
  showGraph(graph, d.id);
  setUpload(null);
}

// Off the list. Its graph stays on screen until another pick.
export function removeRow(id: string) {
  if (userData.get().building === id) stopEngine();
  userData.set((s) => ({ datasets: s.datasets.filter((d) => d.id !== id) }));
  if (id === userData.get().draft) startDraft();
}

export function stopBuild() {
  if (data.get().running) stopEngine();
}
