import { createStore } from "./createStore";
import { data } from "../data/dataStore";
import { layout, retyped } from "./layout";
import type { SlotId } from "./layout";
import { selection } from "./selection";
import type { SelectionState, SelectTarget } from "./selection";
import { ui } from "./uiStore";

// Auto Sweep: a band travels along one axis of a pane, coming in at one end and
// running wholly off the other before it comes in again, or (Wrap, a click on
// the pane's footer strip) coming back in at the start as it leaves the end,
// 60 steps a pass (4 s at 100% speed), and the items inside it light up in
// every pane. Each pane type
// has two axes, given by the pane itself (registerSweepAxis): top to bottom,
// or left to right (sideways) while the strip's Vertical switch is off. The matrix's two are its edge points
// down the diagonal and its rows and columns; Labels has its rows alone.
// A sweep is a temporary selection of its own: while it is active, panes show
// only the swept sets (shownSets), and the node and edge sets stay untouched
// beneath. One sweep is active at a time, running or paused. The arrow keys
// pause it and step the band one step, ↓ and → forward, ↑ and ← back; held,
// they move it at the Speed rate. A paused band keeps its step and re-reads the axis, so it follows a
// rotation or a re-sort as a running one does. Any selection change stops it
// (a gesture, a list click, a set's Clear), as do Stop, a dataset switch and
// its slot changing type. Navigating never does.

export const SWEEP_STEPS = 60;
const PERIOD_MS = 4000;
// How long an arrow is held before the band moves on its own, so a tap is
// always one step.
const HOLD_DELAY_MS = 250;

const EMPTY: ReadonlySet<number> = new Set();

// ---------- Settings ----------

// The band's area, as a percent of the axis's extent.
export const SWEEP_AREA = { min: 1, max: 50, opening: 20 } as const;

// How fast the band travels, as a percent of one pass in PERIOD_MS.
export const SWEEP_SPEED = { min: 25, max: 400, opening: 100 } as const;

// Sideways (the off side of Vertical), area,
// speed and wrap are one value each, shown in every pane's strip (wrap in the
// footer strip's band), so any pane sweeps as the last one did. They last the
// session. What the band lights is the top strip's Select mode.
export interface SweepSettings {
  sideways: boolean;
  area: number;
  speed: number;
  wrap: boolean;
}

export const sweepSettings = createStore<SweepSettings>({
  sideways: false,
  area: SWEEP_AREA.opening,
  speed: SWEEP_SPEED.opening,
  wrap: false,
});

export function setSweepSideways(sideways: boolean) {
  sweepSettings.set({ sideways });
}

export function setSweepArea(area: number) {
  sweepSettings.set({ area });
}

export function setSweepSpeed(speed: number) {
  sweepSettings.set({ speed });
}

export function toggleSweepWrap() {
  sweepSettings.set((s) => ({ wrap: !s.wrap }));
}

// ---------- State ----------

export interface SweepState {
  slot: SlotId | null; // the slot sweeping, or null
  paused: boolean;
  step: number;
  nodes: ReadonlySet<number>;
  edges: ReadonlySet<number>;
  held: -1 | 0 | 1; // the arrow held down (1 forward along the axis, -1 back), or 0
}

export const sweep = createStore<SweepState>({ slot: null, paused: false, step: 0, nodes: EMPTY, edges: EMPTY, held: 0 });

// What panes draw: the sweep while it is active, otherwise the selection.
export const shownIn = (sel: SelectionState, sw: SweepState): SelectionState =>
  sw.slot === null ? sel : { nodes: sw.nodes, edges: sw.edges };
export const shownSets = () => shownIn(selection.get(), sweep.get());

// ---------- The band, as pure functions (sweep.test.ts) ----------

// Each item's place along the pane's axis, in [0, 1], 0 where the band
// starts. An axis places nodes, edges, or both. With nodes alone an edge is in
// the band when both its ends are, as a shape's are; with edges alone (the
// matrix's diagonal) a node is when an edge of its is, as a matrix shape's
// endpoints are.
export interface SweepAxis {
  nodes?: ArrayLike<number>;
  edges?: ArrayLike<number>;
}

// The step `by` steps on from `step`, wrapping at both ends.
export const wrapStep = (step: number, by: number) => (((step + by) % SWEEP_STEPS) + SWEEP_STEPS) % SWEEP_STEPS;

// Where the band `w` thick starts at `step`. Running off, from -w, wholly
// before the axis, at step 0, on towards 1, wholly past it, so step 0 lights
// nothing; wrapping, from 0 on towards 1. Either way every place is lit for
// as many steps.
export const bandStart = (step: number, w: number, wrap: boolean) =>
  wrap ? step / SWEEP_STEPS : (step / SWEEP_STEPS) * (1 + w) - w;

// Inside [t, t + w), wrapping past 1 back to 0 if `wrap`.
export const inBand = (p: number, t: number, w: number, wrap: boolean) =>
  (p >= t && p < t + w) || (wrap && p < t + w - 1);

// The step whose band starts nearest `t`.
function stepAt(t: number, w: number, wrap: boolean) {
  const s = Math.round(wrap ? (t < 0 ? t + 1 : t) * SWEEP_STEPS : ((t + w) / (1 + w)) * SWEEP_STEPS);
  return wrapStep(s, 0);
}

// The sets the band lights at `step`, `w` thick, with the mode's other set
// left empty.
export function bandSets(
  axis: SweepAxis,
  step: number,
  w: number,
  mode: SelectTarget,
  source: Uint32Array,
  target: Uint32Array,
  wrap = false,
): { nodes: Set<number>; edges: Set<number> } {
  const t = bandStart(step, w, wrap);
  const lit = (p: number) => inBand(p, t, w, wrap);
  const nodes = new Set<number>();
  const edges = new Set<number>();
  const { nodes: placed, edges: own } = axis;
  if (placed) {
    const inside = new Uint8Array(placed.length);
    for (let v = 0; v < placed.length; v++) {
      if (lit(placed[v]!)) {
        inside[v] = 1;
        nodes.add(v);
      }
    }
    if (mode !== "node") {
      for (let e = 0; e < source.length; e++) {
        if (own ? lit(own[e]!) : inside[source[e]!] && inside[target[e]!]) edges.add(e);
      }
    }
  } else if (own) {
    for (let e = 0; e < source.length; e++) {
      if (!lit(own[e]!)) continue;
      edges.add(e);
      nodes.add(source[e]!).add(target[e]!);
    }
  }
  return { nodes: mode === "edge" ? new Set() : nodes, edges: mode === "node" ? new Set() : edges };
}

// ---------- Axes, given by the mounted panes ----------

// Wrapping, an axis whose far end would light with its start keeps short of
// it (the hop census sideways).
type AxisReader = (sideways: boolean, wrap: boolean) => SweepAxis | null;

const axes = new Map<SlotId, AxisReader>();

// The pane's axis as it is now, top to bottom or (sideways) left to right;
// read once per step, so rotating, a live tick or a re-sort shows at the next
// step.
export function registerSweepAxis(slot: SlotId, axis: AxisReader): () => void {
  axes.set(slot, axis);
  return () => {
    if (axes.get(slot) === axis) axes.delete(slot);
  };
}

// ---------- The clock ----------

// Running, the band's step follows from t0, when step 0 was. Paused, a held
// arrow (the store's held, ±1) moves it one step at each holdNext.
let raf = 0;
let t0 = 0;
let holdNext = 0;
let lastRead = 0;

const stepMs = (speed: number) => PERIOD_MS / SWEEP_STEPS / (speed / 100);

function bandAt(slot: SlotId, step: number): { nodes: ReadonlySet<number>; edges: ReadonlySet<number> } {
  const graph = data.get().graph;
  const { sideways, area, wrap } = sweepSettings.get();
  const axis = axes.get(slot)?.(sideways, wrap) ?? null;
  if (!graph || !axis) return { nodes: EMPTY, edges: EMPTY };
  return bandSets(axis, step, area / 100, ui.get().selectMode, graph.edgeSource, graph.edgeTarget, wrap);
}

function show(slot: SlotId, step: number) {
  sweep.set({ slot, step, ...bandAt(slot, step) });
}

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) => a.size === b.size && [...a].every((x) => b.has(x));

// A paused band reads its axis again, but the store changes only when what
// it lights does, so still panes don't redraw.
function reread(slot: SlotId, step: number) {
  const sets = bandAt(slot, step);
  const now = sweep.get();
  if (!sameSet(sets.nodes, now.nodes) || !sameSet(sets.edges, now.edges)) sweep.set(sets);
}

// The store changes only when the step does (about 15 times a second), or
// when a paused band lights something new.
function tick(now: number) {
  const { slot, step, paused, held } = sweep.get();
  if (slot === null) return;
  const ms = stepMs(sweepSettings.get().speed);
  if (!paused) {
    const next = Math.floor((now - t0) / ms) % SWEEP_STEPS;
    if (next !== step) show(slot, next);
  } else if (held !== 0 && now >= holdNext) {
    const by = 1 + Math.floor((now - holdNext) / ms);
    holdNext += by * ms;
    lastRead = now;
    show(slot, wrapStep(step, held * by));
  } else if (now - lastRead >= PERIOD_MS / SWEEP_STEPS) {
    lastRead = now;
    reread(slot, step);
  }
  raf = requestAnimationFrame(tick);
}

// Running, step `step` is now, a hair into it, so float error never lands on
// the one before.
function anchor(step: number) {
  t0 = performance.now() - (step + 1e-6) * stepMs(sweepSettings.get().speed);
}

export function startSweep(slot: SlotId) {
  stopSweep();
  t0 = performance.now();
  show(slot, 0);
  raf = requestAnimationFrame(tick);
}

// Carries on from the paused step at the current speed.
export function resumeSweep() {
  const { slot, step, paused } = sweep.get();
  if (slot === null || !paused) return;
  anchor(step);
  sweep.set({ paused: false, held: 0 });
}

// An arrow: pause, step once `dir` (1 forward along the axis, -1 back) and hold, so
// the band moves on at the Speed rate until releaseStep. Whether a sweep was
// active to take it.
export function pressStep(dir: 1 | -1): boolean {
  const { slot, step } = sweep.get();
  if (slot === null) return false;
  lastRead = holdNext = performance.now() + HOLD_DELAY_MS;
  sweep.set({ paused: true, held: dir });
  show(slot, wrapStep(step, dir));
  return true;
}

// Ends the hold if it is this arrow's; with no arrow, any hold. The band stays
// paused where it is.
export function releaseStep(dir?: 1 | -1) {
  const { held } = sweep.get();
  if (held !== 0 && (dir === undefined || held === dir)) sweep.set({ held: 0 });
}

// Whether a sweep was active.
export function stopSweep(): boolean {
  cancelAnimationFrame(raf);
  raf = 0;
  if (sweep.get().slot === null) return false;
  sweep.set({ slot: null, paused: false, step: 0, nodes: EMPTY, edges: EMPTY, held: 0 });
  return true;
}

selection.subscribe(() => stopSweep());

data.subscribe((s, prev) => {
  if (s.graph !== prev.graph) stopSweep();
});

// A slot that changes type, or leaves the line-up, stops its sweep.
layout.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  const slot = sweep.get().slot;
  if (slot !== null && (fresh.includes(slot) || !s.slots.some((x) => x.slot === slot))) stopSweep();
});

// A new Select mode shows at once, at the same step.
ui.subscribe((s, prev) => {
  const { slot, step } = sweep.get();
  if (slot !== null && s.selectMode !== prev.selectMode) show(slot, step);
});

// A new orientation or area shows at once, at the same step. A new speed carries on
// from where the band is, so it never jumps (a held arrow takes it from its
// next step). So does Wrap: the band keeps its place, at the step nearest it.
sweepSettings.subscribe((s, prev) => {
  const { slot, step, paused } = sweep.get();
  if (slot === null) return;
  if (s.speed !== prev.speed && !paused) {
    const now = performance.now();
    t0 = now - ((now - t0) / stepMs(prev.speed)) * stepMs(s.speed);
  }
  if (s.wrap !== prev.wrap) {
    const w = s.area / 100;
    const next = stepAt(bandStart(step, w, prev.wrap), w, s.wrap);
    if (!paused) anchor(next);
    show(slot, next);
  } else if (s.area !== prev.area || s.sideways !== prev.sideways) show(slot, step);
});
