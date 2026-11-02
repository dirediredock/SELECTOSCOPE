import { CENSUS_MEASURES } from "../controlOptions";
import { createStore } from "./createStore";
import { datasetStore } from "./dataset";
import { fitView } from "./fitRequests";
import { paneRowStore, retyped } from "./paneRow";
import type { SlotId } from "./paneRow";

// Hops' settings, chosen in the bottom strip. Each Hops slot has its
// own, and a dataset switch is a fresh start.

// What orders the lines sideways: the shape order (panes/hops/geometry.ts).
export type CensusMeasure = (typeof CENSUS_MEASURES)[number]["id"];

// How far right the shape order moves a line at its far end, in multiples
// of a bin's side (panes/hops/geometry.ts); 0 lines every line up at hop 0.
export const SLIDE = { max: 50, opening: 2 } as const;

// The slider's rail runs squared: the multiple is max · t², t along the rail.
// Why: lines still read as lines at about 0–2×, which a linear rail would
// squeeze into its first 4%. The multiple snaps to what the readout shows.
export const SLIDE_RAIL = { min: 0, max: 1000 } as const;

export function slideFromRail(r: number) {
  const s = SLIDE.max * (r / SLIDE_RAIL.max) ** 2;
  return s < 9.95 ? Math.round(s * 10) / 10 : Math.round(s);
}

export const railOfSlide = (s: number) => Math.round(SLIDE_RAIL.max * Math.sqrt(s / SLIDE.max));

// One decimal under 10×, whole multiples from there.
export const slideText = (s: number) => `${s < 10 ? +s.toFixed(1) : Math.round(s)}×`;

export interface HopsSettings {
  measure: CensusMeasure; // what orders the lines sideways
  rank: boolean; // lines spaced by their rank along the order, else by the measure's value
  slide: number; // multiples of the side
}

const OPENING: HopsSettings = { measure: "reach", rank: false, slide: SLIDE.opening };

type BySlot = Partial<Record<SlotId, HopsSettings>>;

export const hopsPaneStore = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const hopsIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? OPENING;
export const hopsOf = (slot: SlotId) => hopsIn(hopsPaneStore.get(), slot);

function update(slot: SlotId, patch: Partial<HopsSettings>) {
  hopsPaneStore.set((s) => ({ bySlot: { ...s.bySlot, [slot]: { ...hopsIn(s, slot), ...patch } } }));
}

// A new order keeps the zoom and pan: the fit leaves room for every line's
// full slide in any order, so orders compare at one scale and only the lines
// move.
export function setMeasure(slot: SlotId, measure: CensusMeasure) {
  update(slot, { measure });
}

export function toggleRank(slot: SlotId) {
  update(slot, { rank: !hopsOf(slot).rank });
}

// The fit covers every slid line, so the view refits and the new pattern
// shows whole.
export function setSlide(slot: SlotId, slide: number) {
  update(slot, { slide });
  fitView(slot);
}

datasetStore.subscribe((s, prev) => {
  if (s.graph !== prev.graph) hopsPaneStore.set({ bySlot: {} });
});

// A slot that becomes Hops starts from the defaults.
paneRowStore.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => hopsPaneStore.get().bySlot[slot])) return;
  const bySlot = { ...hopsPaneStore.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  hopsPaneStore.set({ bySlot });
});
