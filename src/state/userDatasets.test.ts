import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildOptions } from "../engine/engine";
import type { Graph } from "../data/graph";
import type { DatasetTexts } from "../pipeline/ingest";

// The interface store reads the saved theme and settings on import.
vi.hoisted(() => {
  Object.assign(globalThis, {
    document: { documentElement: { dataset: {}, style: { setProperty() {} } } },
    localStorage: { getItem: () => null, setItem() {} },
  });
});

// The engine with no workers: each test plays the build's hooks itself. As
// the real one, a new build or Stop ends the build before it.
const engine = vi.hoisted(() => ({
  runs: [] as { texts: DatasetTexts; opts: BuildOptions }[],
  current: null as BuildOptions | null,
}));

vi.mock("../engine/engine", () => {
  const end = () => {
    const prev = engine.current;
    engine.current = null;
    prev?.onEnd?.(null);
  };
  return {
    startBuild: (texts: DatasetTexts, opts: BuildOptions) => {
      end();
      engine.current = opts;
      engine.runs.push({ texts, opts });
    },
    stopBuild: end,
  };
});

// A graph whose every stage has landed, or only its ingest.
function graph(finished: boolean, refused: Graph["refused"] = []): Graph {
  const done = <T>(x: T) => (finished ? x : null);
  return {
    name: "user",
    title: "",
    n: 3,
    m: 2,
    refused,
    warnings: [],
    report: { rows: 2, selfLoops: 0, repeated: 0, components: 1, droppedNodes: 0, droppedEdges: 0 },
    layoutFd: done(new Float32Array(6)),
    cores: done({}),
    ksnakes: done({}),
    hopCensus: done({}),
    seriations: finished ? { harm1: new Uint32Array(3), pc1: new Uint32Array(3) } : {},
  } as unknown as Graph;
}

const csv = (name: string, text = "source,target\na,b\nb,c\n") => new File([text], name);

const last = () => engine.runs[engine.runs.length - 1]!.opts;

async function load() {
  vi.resetModules();
  const ud = await import("./userDatasets");
  const { interfaceStore, setUpload } = await import("./interface");
  const { datasetStore } = await import("../data/datasetStore");
  // The build's end, as the engine signals it: finished, or stopped.
  const { stopBuild: end } = await import("../engine/engine");
  const listed = () => ud.userDatasetsStore.get().datasets.filter((d) => d.graph !== null);
  const draft = () => ud.draftOf(ud.userDatasetsStore.get());
  return { ...ud, interfaceStore, setUpload, datasetStore, end, listed, draft };
}

// A finished row built from CSVs, its id.
async function builtRow(m: Awaited<ReturnType<typeof load>>, files: Record<string, File> = {}) {
  const id = m.userDatasetsStore.get().draft;
  await m.addFile(id, "edgelist", csv("roads.csv"), false);
  for (const [kind, f] of Object.entries(files)) await m.addFile(id, kind as "labels", f, false);
  m.buildDraft();
  last().onIngested!(graph(true));
  m.end();
  return id;
}

beforeEach(() => {
  engine.runs = [];
  engine.current = null;
});

describe("buildState", () => {
  it("reads every state from the files and the build", async () => {
    const { buildState, draftOf, userDatasetsStore } = await load();
    const d = draftOf(userDatasetsStore.get());
    const edges = { ...d.files, edgelist: { fileName: "e.csv", text: "" } };
    expect(buildState(d, false)).toBe("idle");
    expect(buildState({ ...d, files: edges }, true)).toBe("running");
    expect(buildState({ ...d, files: edges, version: 2, failedVersion: 2 }, false)).toBe("failed");
    expect(buildState({ ...d, files: edges, version: 2, failedVersion: 1 }, false)).toBe("idle");
    expect(buildState({ ...d, files: edges, version: 2, builtVersion: 1, graph: graph(true) }, false)).toBe("stale");
    expect(buildState({ ...d, files: edges, version: 2, builtVersion: 2, graph: graph(true) }, false)).toBe("done");
    // Cut short: build again.
    expect(buildState({ ...d, files: edges, version: 2, builtVersion: 2, graph: graph(false) }, false)).toBe("idle");
  });
});

describe("Build", () => {
  it("makes no row from a refused edge list, and waits for a file to change", async () => {
    const m = await load();
    const id = m.userDatasetsStore.get().draft;
    await m.addFile(id, "edgelist", csv("bad.csv", "from,to\na,b\n"), false);
    m.buildDraft();
    last().onRefused!("needs source and target columns");
    m.end();
    expect(m.listed()).toEqual([]);
    expect(m.buildState(m.draft(), false)).toBe("failed");
    expect(m.fileRefused(m.draft(), "edgelist")).toBe(true);
    await m.addFile(id, "edgelist", csv("good.csv"), false);
    expect(m.buildState(m.draft(), false)).toBe("idle");
    expect(m.draft().name).toBe("good");
  });

  it("hands over to the row once its edge list is read", async () => {
    const m = await load();
    m.setUpload("csv");
    const id = m.userDatasetsStore.get().draft;
    await m.addFile(id, "edgelist", csv("roads.csv"), false);
    m.buildDraft();
    expect(last().current).toBe(id);
    expect(m.interfaceStore.get().upload).toBe("csv");
    last().onIngested!(graph(false));
    expect(m.listed().map((d) => d.id)).toEqual([id]);
    expect(m.userDatasetsStore.get().building).toBe(id);
    expect(m.userDatasetsStore.get().draft).not.toBe(id);
    expect(m.draft().files.edgelist).toBe(null);
    expect(m.interfaceStore.get().upload).toBe(null);
  });

  it("leaves a stopped row to build again, from its files", async () => {
    const m = await load();
    const id = m.userDatasetsStore.get().draft;
    await m.addFile(id, "edgelist", csv("roads.csv"), false);
    m.buildDraft();
    last().onIngested!(graph(false));
    m.end();
    const d = m.datasetOf(m.userDatasetsStore.get(), id)!;
    expect(m.buildState(d, false)).toBe("idle");
    m.pickRow(id);
    expect(engine.runs).toHaveLength(2);
    expect(last().current).toBe(id);
  });

  it("stays on + New when the edge list is refused", async () => {
    const m = await load();
    m.setUpload("csv");
    const id = m.userDatasetsStore.get().draft;
    await m.addFile(id, "edgelist", csv("bad.csv", "from,to\na,b\n"), false);
    m.buildDraft();
    last().onRefused!("needs source and target columns");
    m.end();
    expect(m.userDatasetsStore.get().draft).toBe(id);
    expect(m.interfaceStore.get().upload).toBe("csv");
  });

  it("keeps the other files when the edge list is replaced", async () => {
    const m = await load();
    const id = m.userDatasetsStore.get().draft;
    await m.addFile(id, "edgelist", csv("a.csv"), false);
    await m.addFile(id, "labels", csv("names.csv", "node_id,label\na,A\n"), false);
    await m.addFile(id, "edgelist", csv("b.csv"), false);
    expect(m.draft().files.labels?.fileName).toBe("names.csv");
    expect(engine.runs).toEqual([]);
  });
});

describe("a row", () => {
  it("builds again as the same row when its edge list is replaced", async () => {
    const m = await load();
    const id = await builtRow(m);
    await m.addFile(id, "edgelist", csv("roads2.csv"), true);
    expect(engine.runs).toHaveLength(2);
    expect(last().current).toBe(id);
    const g2 = graph(true);
    last().onIngested!(g2);
    m.end();
    expect(m.listed().map((d) => d.id)).toEqual([id]);
    expect(m.datasetOf(m.userDatasetsStore.get(), id)!.graph).toBe(g2);
  });

  it("keeps its last good graph when a new edge list is refused", async () => {
    const m = await load();
    const id = await builtRow(m);
    const before = m.datasetOf(m.userDatasetsStore.get(), id)!.graph;
    await m.addFile(id, "edgelist", csv("bad.csv", "from,to\n"), true);
    last().onRefused!("needs source and target columns");
    m.end();
    const d = m.datasetOf(m.userDatasetsStore.get(), id)!;
    expect(d.graph).toBe(before);
    expect(m.fileRefused(d, "edgelist")).toBe(true);
    expect(m.datasetAlert(d)).toBe(true);
  });

  it("builds again without a file removed from it", async () => {
    const m = await load();
    const id = await builtRow(m, { labels: csv("names.csv", "node_id,label\na,A\n") });
    expect(engine.runs[0]!.texts.labels).toBeDefined();
    await m.removeFile(id, "labels", true);
    expect(engine.runs).toHaveLength(2);
    expect(last().current).toBe(id);
    expect(engine.runs[1]!.texts.labels).toBeUndefined();
  });

  it("marks a refused file and a failed stage", async () => {
    const m = await load();
    const id = m.userDatasetsStore.get().draft;
    await m.addFile(id, "edgelist", csv("roads.csv"), false);
    await m.addFile(id, "labels", csv("names.csv", "node_id,label\nz,Z\n"), false);
    m.buildDraft();
    last().onIngested!(graph(false, [{ kind: "labels", reason: "1 node_id not in the edge list" }]));
    const row = () => m.datasetOf(m.userDatasetsStore.get(), id)!;
    expect(m.fileRefused(row(), "labels")).toBe(true);
    last().onEnd!("Hops failed: its worker stopped");
    expect(row().failure).toBe("Hops failed: its worker stopped");
    expect(m.datasetAlert(row())).toBe(true);
  });

  it("comes off the list, and a removed draft starts afresh", async () => {
    const m = await load();
    const id = await builtRow(m);
    m.removeRow(id);
    expect(m.listed()).toEqual([]);
    const draft = m.userDatasetsStore.get().draft;
    m.removeRow(draft);
    expect(m.userDatasetsStore.get().draft).not.toBe(draft);
  });
});

describe("JSON", () => {
  const build = readFileSync(join(__dirname, "..", "..", "public", "builds", "karate_club.json"), "utf8");

  it("reads a build file on pick, and adds it as a new row, newest first, on screen", async () => {
    const m = await load();
    m.setUpload("json");
    await m.pickJson(new File([build], "first.json"));
    expect(m.listed()).toEqual([]);
    expect(m.userDatasetsStore.get().jsonName).toBe("Karate Club");
    m.addJson();
    await m.pickJson(new File([build], "second.json"));
    m.setJsonName("Mine");
    m.addJson();
    const rows = m.listed();
    expect(rows.map((d) => d.origin)).toEqual(["json", "json"]);
    expect(rows.map((d) => d.name)).toEqual(["Mine", "Karate Club"]);
    expect(m.datasetStore.get().current).toBe(rows[0]!.id);
    expect(m.datasetStore.get().graph).toBe(rows[0]!.graph);
    expect(rows[0]!.graph!.name).toBe("user");
    expect(m.userDatasetsStore.get().jsonDraft).toBe(null);
    expect(m.interfaceStore.get().upload).toBe(null);
  });

  it("keeps a name typed before the file is picked", async () => {
    const m = await load();
    m.setJsonName("Typed");
    await m.pickJson(new File([build], "first.json"));
    expect(m.userDatasetsStore.get().jsonName).toBe("Typed");
  });

  it("refuses an unreadable file on pick, and why, adding nothing", async () => {
    const m = await load();
    await m.pickJson(new File(["{"], "notes.json"));
    expect(m.userDatasetsStore.get().jsonRefusal).toEqual({ fileName: "notes.json", reason: "not JSON" });
    await m.pickJson(new File(['{"meta":{"format":0}}'], "old.json"));
    expect(m.userDatasetsStore.get().jsonRefusal).toEqual({ fileName: "old.json", reason: "not a build of format 1" });
    m.addJson();
    expect(m.listed()).toEqual([]);
  });
});
