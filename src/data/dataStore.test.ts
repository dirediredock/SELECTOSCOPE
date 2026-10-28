import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Loads race: a newer pick wins over an older one still in flight, whether
// the newer one is a curated build, a user build or an opened file. Fetch is
// stubbed so each test decides when a response lands.
const BUILDS = join(__dirname, "..", "..", "public", "builds");
const body = (name: string) => readFileSync(join(BUILDS, `${name}.json`), "utf8");

let held: Map<string, (r: Response) => void>;

// Lands the pending fetch of `url`, then lets its promise chain run.
async function release(url: string, text: string) {
  held.get(url)!(new Response(text));
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function load() {
  vi.resetModules();
  return import("./datasetStore");
}

beforeEach(() => {
  held = new Map();
  vi.stubGlobal("fetch", (url: string) => new Promise<Response>((resolve) => held.set(url, resolve)));
});

afterEach(() => vi.unstubAllGlobals());

describe("loadDataset", () => {
  it("shows the build once it lands", async () => {
    const { datasetStore, loadDataset } = await load();
    const done = loadDataset("karate_club", () => {});
    expect(datasetStore.get().loading).toBe(true);
    await release("builds/karate_club.json", body("karate_club"));
    await done;
    expect(datasetStore.get().current).toBe("karate_club");
    expect(datasetStore.get().graph?.name).toBe("karate_club");
    expect(datasetStore.get().loading).toBe(false);
  });

  it("lets the later of two picks win, whichever lands first", async () => {
    const { datasetStore, loadDataset } = await load();
    const first = loadDataset("karate_club", () => {});
    const second = loadDataset("dolphins", () => {});
    await release("builds/dolphins.json", body("dolphins"));
    await release("builds/karate_club.json", body("karate_club"));
    await Promise.all([first, second]);
    expect(datasetStore.get().current).toBe("dolphins");
  });

  it("never lands once a user build or an opened file cancels it", async () => {
    const { cancelLoad, datasetStore, loadDataset } = await load();
    const stop = vi.fn();
    const done = loadDataset("karate_club", stop);
    cancelLoad();
    expect(datasetStore.get().loading).toBe(false);
    expect(datasetStore.get().requested).toBe(null);
    await release("builds/karate_club.json", body("karate_club"));
    await done;
    expect(datasetStore.get().graph).toBe(null);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("empties the panes while the next build downloads", async () => {
    const { datasetStore, loadDataset } = await load();
    const first = loadDataset("karate_club", () => {});
    await release("builds/karate_club.json", body("karate_club"));
    await first;
    const stop = vi.fn();
    const second = loadDataset("dolphins", stop);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(datasetStore.get().graph).toBe(null);
    expect(datasetStore.get().current).toBe(null);
    await release("builds/dolphins.json", body("dolphins"));
    await second;
    expect(datasetStore.get().graph?.name).toBe("dolphins");
  });
});

describe("initData", () => {
  it("opens on no curated build when the user picked first", async () => {
    const { cancelLoad, datasetStore, initData } = await load();
    const done = initData(() => {});
    cancelLoad();
    await release("builds/index.json", readFileSync(join(BUILDS, "index.json"), "utf8"));
    await done;
    expect(datasetStore.get().index?.length).toBeGreaterThan(0);
    expect(held.size).toBe(1);
    expect(datasetStore.get().loading).toBe(false);
  });
});
