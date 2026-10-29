import { createStore } from "./createStore";
import { LABEL_SORTS } from "../controlOptions";
import { datasetStore } from "./dataset";
import { paneRowStore, retyped } from "./paneRow";
import type { SlotId } from "./paneRow";
import type { Graph } from "../data/graph";

// The Labels pane's sort, chosen in the bottom strip. Each Labels slot has its
// own; it resets on a dataset switch, which is a fresh start. Selected rows
// float to the top in every sort (panes/labels/order.ts).

export type LabelSort = (typeof LABEL_SORTS)[number]["id"];
export const DEFAULT_LABEL_SORT: LabelSort = "degree";

type BySlot = Partial<Record<SlotId, LabelSort>>;

export const labelsPaneStore = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const labelSortIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? DEFAULT_LABEL_SORT;
export const labelSortOf = (slot: SlotId) => labelSortIn(labelsPaneStore.get(), slot);

// Labels (A–Z) needs labels to sort: without them the pane shows a message in
// place of the rows, with nothing to sweep.
export const labelsMissing = (g: Graph | null, sort: LabelSort) => !!g && sort === "alpha" && !g.hasLabels;

export function setLabelSort(slot: SlotId, sort: LabelSort) {
  if (sort === labelSortOf(slot)) return;
  labelsPaneStore.set((s) => ({ bySlot: { ...s.bySlot, [slot]: sort } }));
}

datasetStore.subscribe((s, prev) => {
  if (s.graph !== prev.graph) labelsPaneStore.set({ bySlot: {} });
});

// A slot that becomes Labels starts from the default.
paneRowStore.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => labelsPaneStore.get().bySlot[slot])) return;
  const bySlot = { ...labelsPaneStore.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  labelsPaneStore.set({ bySlot });
});
