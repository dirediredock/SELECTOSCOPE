import { CENSUS_MEASURES } from "../controlOptions";
import { createStore } from "./createStore";
import { data } from "../data/dataStore";
import { fitView } from "./views";
import { layout, retyped } from "./layout";
import type { SlotId } from "./layout";

// Hops' settings, chosen in the bottom strip. Each Hops slot has its
// own, and a dataset switch is a fresh start.

// What orders the lines sideways: the shape order (panes/hopcensus/geometry.ts).
export type CensusMeasure = (typeof CENSUS_MEASURES)[number]["id"];

// How far right the shape order moves a line at its far end, in multiples
// of a bin's side (panes/hopcensus/geometry.ts); 0 lines every line up at hop 0.
export const SLIDE = { max: 50, opening: 1 } as const;

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

export interface HopCensusSettings {
  measure: CensusMeasure; // what orders the lines sideways
  rank: boolean; // lines spaced by their rank along the order, else by the measure's value
  slide: number; // multiples of the side
}

const OPENING: HopCensusSettings = { measure: "reach", rank: false, slide: SLIDE.opening };

type BySlot = Partial<Record<SlotId, HopCensusSettings>>;

export const hopcensusSettings = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const hopcensusIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? OPENING;
export const hopcensusOf = (slot: SlotId) => hopcensusIn(hopcensusSettings.get(), slot);

function update(slot: SlotId, patch: Partial<HopCensusSettings>) {
  hopcensusSettings.set((s) => ({ bySlot: { ...s.bySlot, [slot]: { ...hopcensusIn(s, slot), ...patch } } }));
}

// A new order keeps the zoom and pan: the fit leaves room for every line's
// full slide in any order, so orders compare at one scale and only the lines
// move.
export function setMeasure(slot: SlotId, measure: CensusMeasure) {
  update(slot, { measure });
}

export function toggleRank(slot: SlotId) {
  update(slot, { rank: !hopcensusOf(slot).rank });
}

// The fit covers every slid line, so the view refits and the new pattern
// shows whole.
export function setSlide(slot: SlotId, slide: number) {
  update(slot, { slide });
  fitView(slot);
}

data.subscribe((s, prev) => {
  if (s.graph !== prev.graph) hopcensusSettings.set({ bySlot: {} });
});

// A slot that becomes Hops starts from the defaults.
layout.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => hopcensusSettings.get().bySlot[slot])) return;
  const bySlot = { ...hopcensusSettings.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  hopcensusSettings.set({ bySlot });
});
