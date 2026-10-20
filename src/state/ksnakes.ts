import { createStore } from "./createStore";
import { ORDERINGS } from "../controlOptions";
import { data } from "../data/dataStore";
import { fitView } from "./views";
import { layout, retyped } from "./layout";
import type { SlotId } from "./layout";

// Shells' settings, chosen in the bottom strip while it is focused. Each Shells
// slot has its own, and a dataset switch is a fresh start.

export type Ordering = (typeof ORDERINGS)[number]["id"];

// The pipeline orders two modes: every singleton in its own bin, or a
// shell's singletons grouped in one bin, a count pill per onion layer.
export type PipelineMode = "separate" | "aggregate";
export const modeOf = (group: boolean): PipelineMode => (group ? "aggregate" : "separate");

// The pattern's shape: at 100% zoom it fills the pane's height, and Spacing is
// its width as % of the room between the axis gutters. Size is the zoom's job,
// so this is the one setting zoom can't reach. The extra space between two K
// spans is always K_GAP onion layers.
export const BIN_SPACING = { min: 10, max: 400, opening: 100 } as const;
export const K_GAP = 2;

export interface KSnakesSettings {
  ordering: Ordering;
  group: boolean; // the singleton group
  gridlines: boolean; // the hairlines between bins
  spacing: number; // the pattern's width, % of the room between the axis gutters
}

const OPENING: KSnakesSettings = {
  ordering: "topdown",
  group: false,
  gridlines: false,
  spacing: BIN_SPACING.opening,
};

type BySlot = Partial<Record<SlotId, KSnakesSettings>>;

export const ksnakesSettings = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const ksnakesIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? OPENING;
export const ksnakesOf = (slot: SlotId) => ksnakesIn(ksnakesSettings.get(), slot);

function update(slot: SlotId, patch: Partial<KSnakesSettings>) {
  ksnakesSettings.set((s) => ({ bySlot: { ...s.bySlot, [slot]: { ...ksnakesIn(s, slot), ...patch } } }));
}

// The height stays, so the view does too; the nodes glide to their new x.
export function setOrdering(slot: SlotId, ordering: Ordering) {
  update(slot, { ordering });
}

export function toggleGroup(slot: SlotId) {
  update(slot, { group: !ksnakesOf(slot).group });
}

export function toggleGridlines(slot: SlotId) {
  update(slot, { gridlines: !ksnakesOf(slot).gridlines });
}

// A new spacing refits, so the new shape shows whole.
export function setBinSpacing(slot: SlotId, spacing: number) {
  update(slot, { spacing });
  fitView(slot);
}

data.subscribe((s, prev) => {
  if (s.graph !== prev.graph) ksnakesSettings.set({ bySlot: {} });
});

// A slot that becomes Shells starts from the defaults.
layout.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => ksnakesSettings.get().bySlot[slot])) return;
  const bySlot = { ...ksnakesSettings.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  ksnakesSettings.set({ bySlot });
});
