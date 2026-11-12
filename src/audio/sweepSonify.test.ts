import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Graph } from "../data/graph";
import { RING } from "./voices";

vi.mock("../state/controls", async () => {
  const { createStore } = await import("../state/createStore");
  return { controlsStore: createStore({ selectMode: "both" }) };
});

const play = vi.fn();
const wake = vi.fn();
const sleep = vi.fn();
vi.mock("./synth", () => ({ play, wake, sleep }));

// Ten nodes down a line, pitched low to high, swept in a slot of their own.
async function load() {
  vi.resetModules();
  const sweep = await import("../state/sweepRun");
  const { datasetStore } = await import("../state/dataset");
  const { paneRowStore } = await import("../state/paneRow");
  const sound = await import("../state/sweepSound");
  const { soundingStore } = await import("../state/sounding");
  const settings = await import("../state/sweepSettings");
  await import("./sweepSonify");
  // Degrees all 1 but node 9's, so every other note rings shortest.
  const degree = Uint32Array.from({ length: 10 }, (_, i) => (i === 9 ? 2 : 1));
  datasetStore.set({ graph: { edgeSource: Uint32Array.of(0), edgeTarget: Uint32Array.of(1), degree } as unknown as Graph });
  sweep.stopSweep(); // the showcase
  const slot = paneRowStore.get().slots[0]!.slot;
  const at = Array.from({ length: 10 }, (_, i) => (i + 0.5) / 10);
  sweep.registerSweepAxis(slot, () => sweep.nodeVoiced(at, at));
  return { ...sweep, ...sound, ...settings, soundingStore, slot };
}

describe("the sweep's sound", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    play.mockClear();
    wake.mockClear();
    sleep.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("is silent, and flashes nothing, until Sound is on", async () => {
    const m = await load();
    m.startSweep(m.slot);
    for (let i = 0; i < 20; i++) m.pressStep(1);
    expect(play).not.toHaveBeenCalled();
    expect(m.soundingStore.get().nodes.size).toBe(0);
  });

  it("wakes the audio on the switch, and sleeps it off", async () => {
    const m = await load();
    m.toggleSweepSound();
    expect(wake).toHaveBeenCalledOnce();
    m.toggleSweepSound();
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("plays each mark once as the band takes it, and shows it for that step", async () => {
    const m = await load();
    m.toggleSweepSound();
    m.startSweep(m.slot);
    const heard: number[] = [];
    m.soundingStore.subscribe((s) => heard.push(...s.nodes));
    for (let i = 1; i < m.SWEEP_STEPS; i++) m.pressStep(1);
    expect(heard).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(play).toHaveBeenCalledTimes(10);
    // Low marks play low notes, high ones high.
    const freqs = play.mock.calls.map(([tones]) => tones[0].freq);
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b));
    // Node 9, the one of degree 2, rings longest; the rest shortest.
    const rings = play.mock.calls.map(([tones]) => tones[0].ring);
    expect(rings).toEqual([...new Array(9).fill(RING.short), RING.long]);
    vi.advanceTimersByTime(1000 * RING.long);
    expect(m.soundingStore.get().nodes.size).toBe(0);
  });

  it("stays silent when a setting re-shows the same step", async () => {
    const m = await load();
    m.toggleSweepSound();
    m.startSweep(m.slot);
    for (let i = 0; i < 20; i++) m.pressStep(1);
    play.mockClear();
    m.setSweepArea(40);
    expect(play).not.toHaveBeenCalled();
  });

  it("clears the flash when the sweep stops or the sound goes off", async () => {
    const m = await load();
    m.toggleSweepSound();
    m.startSweep(m.slot);
    for (let i = 0; i < 18; i++) m.pressStep(1); // the band has just taken node 3
    expect(m.soundingStore.get().nodes.size).toBeGreaterThan(0);
    m.stopSweep();
    expect(m.soundingStore.get().nodes.size).toBe(0);
    m.startSweep(m.slot);
    for (let i = 0; i < 18; i++) m.pressStep(1); // the band has just taken node 3
    expect(m.soundingStore.get().nodes.size).toBeGreaterThan(0);
    m.toggleSweepSound();
    expect(m.soundingStore.get().nodes.size).toBe(0);
  });

  it("shows a sounding edge with its endpoints, so node panes show it too", async () => {
    const m = await load();
    m.registerSweepAxis(m.slot, () => ({ edges: [0.5], voice: { type: "edge", at: [0.5], pitch: [0.5] } }));
    m.toggleSweepSound();
    m.startSweep(m.slot);
    const seen: { nodes: number[]; edges: number[] }[] = [];
    m.soundingStore.subscribe((s) => s.edges.size && seen.push({ nodes: [...s.nodes], edges: [...s.edges] }));
    for (let i = 1; i < m.SWEEP_STEPS; i++) m.pressStep(1);
    expect(seen).toEqual([{ nodes: [0, 1], edges: [0] }]);
  });
});
