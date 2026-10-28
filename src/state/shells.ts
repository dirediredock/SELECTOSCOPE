import { createStore } from "./createStore";
import { ORDERINGS } from "../controlOptions";
import { datasetStore } from "../data/datasetStore";
import { fitView } from "./paneViews";
import { paneRowStore, retyped } from "./paneRow";
import type { SlotId } from "./paneRow";

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

export interface ShellsSettings {
  ordering: Ordering;
  group: boolean; // the singleton group
  gridlines: boolean; // the hairlines between bins
  spacing: number; // the pattern's width, % of the room between the axis gutters
}

const OPENING: ShellsSettings = {
  ordering: "packed",
  group: true,
  gridlines: false,
  spacing: BIN_SPACING.opening,
};

type BySlot = Partial<Record<SlotId, ShellsSettings>>;

export const shellsStore = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const shellsIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? OPENING;
export const shellsOf = (slot: SlotId) => shellsIn(shellsStore.get(), slot);

function update(slot: SlotId, patch: Partial<ShellsSettings>) {
  shellsStore.set((s) => ({ bySlot: { ...s.bySlot, [slot]: { ...shellsIn(s, slot), ...patch } } }));
}

// The height stays, so the view does too; the nodes glide to their new x.
export function setOrdering(slot: SlotId, ordering: Ordering) {
  update(slot, { ordering });
}

export function toggleGroup(slot: SlotId) {
  update(slot, { group: !shellsOf(slot).group });
}

export function toggleGridlines(slot: SlotId) {
  update(slot, { gridlines: !shellsOf(slot).gridlines });
}

// A new spacing refits, so the new shape shows whole.
export function setBinSpacing(slot: SlotId, spacing: number) {
  update(slot, { spacing });
  fitView(slot);
}

datasetStore.subscribe((s, prev) => {
  if (s.graph !== prev.graph) shellsStore.set({ bySlot: {} });
});

// A slot that becomes Shells starts from the defaults.
paneRowStore.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => shellsStore.get().bySlot[slot])) return;
  const bySlot = { ...shellsStore.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  shellsStore.set({ bySlot });
});
