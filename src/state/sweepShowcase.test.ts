import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Graph } from "../data/graph";

// The band reads the Select mode; the real store reads the page at load.
vi.mock("./uiStore", async () => {
  const { createStore } = await import("./createStore");
  return { ui: createStore({ selectMode: "both" }) };
});

// The showcase is once per module's life, so each test imports it afresh.
async function load() {
  vi.resetModules();
  const sweep = await import("./sweep");
  const { data } = await import("../data/dataStore");
  const { layout, setSlotType } = await import("./layout");
  const matrix = layout.get().slots.find((x) => x.type === "matrix")!.slot;
  // A new graph each time, as a dataset switch lands one.
  const land = () =>
    data.set({ graph: { edgeSource: Uint32Array.of(0), edgeTarget: Uint32Array.of(1) } as unknown as Graph });
  return { ...sweep, land, matrix, setSlotType };
}

describe("the showcase", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sweeps the Matrix on the dataset the app opens on", async () => {
    const m = await load();
    m.land();
    expect(m.sweep.get()).toMatchObject({ slot: m.matrix, paused: false });
  });

  it("opens every later dataset still", async () => {
    const m = await load();
    m.land();
    m.land();
    expect(m.sweep.get().slot).toBe(null);
  });

  it("needs a Matrix in the line-up, and is spent without one", async () => {
    const m = await load();
    m.setSlotType(m.matrix, "nodelink");
    m.land();
    expect(m.sweep.get().slot).toBe(null);
    m.setSlotType(m.matrix, "matrix");
    m.land();
    expect(m.sweep.get().slot).toBe(null);
  });
});
