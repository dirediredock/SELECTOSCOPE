import { createStore } from "./createStore";
import { LABEL_SORTS } from "../controlOptions";
import { data } from "../data/dataStore";
import { layout, retyped } from "./layout";
import type { SlotId } from "./layout";
import type { Graph } from "../data/graph";

// The Labels pane's sort, chosen in the bottom strip. Each Labels slot has its
// own; it resets on a dataset switch, which is a fresh start. Selected rows
// float to the top in every sort (panes/labels/order.ts).

export type LabelSort = (typeof LABEL_SORTS)[number]["id"];
export const DEFAULT_LABEL_SORT: LabelSort = "degree";

type BySlot = Partial<Record<SlotId, LabelSort>>;

export const labelsSettings = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const labelSortIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? DEFAULT_LABEL_SORT;
export const labelSortOf = (slot: SlotId) => labelSortIn(labelsSettings.get(), slot);

// Labels (A–Z) needs labels to sort: without them the pane shows a message in
// place of the rows, with nothing to sweep.
export const labelsMissing = (g: Graph | null, sort: LabelSort) => !!g && sort === "alpha" && !g.hasLabels;

export function setLabelSort(slot: SlotId, sort: LabelSort) {
  if (sort === labelSortOf(slot)) return;
  labelsSettings.set((s) => ({ bySlot: { ...s.bySlot, [slot]: sort } }));
}

data.subscribe((s, prev) => {
  if (s.graph !== prev.graph) labelsSettings.set({ bySlot: {} });
});

// A slot that becomes Labels starts from the default.
layout.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => labelsSettings.get().bySlot[slot])) return;
  const bySlot = { ...labelsSettings.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  labelsSettings.set({ bySlot });
});
