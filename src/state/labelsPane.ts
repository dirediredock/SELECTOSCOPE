import { createStore } from "./createStore";
import { LABEL_SORTS } from "../controlOptions";
import { datasetStore } from "./dataset";
import { paneRowStore, retyped } from "./paneRow";
import type { SlotId } from "./paneRow";
import type { Graph } from "../data/graph";

// The Labels pane's sort and its direction, chosen in the bottom strip. Each
// Labels slot has its own; they reset on a dataset switch, which is a fresh
// start. Selected rows float to the top in every sort (panes/labels/order.ts).

export type LabelSort = (typeof LABEL_SORTS)[number]["id"];

export interface LabelsSettings {
  sort: LabelSort;
  reverse: boolean; // the sort's own key flipped (order.ts says what stays put)
}

const OPENING: LabelsSettings = { sort: "degree", reverse: false };

type BySlot = Partial<Record<SlotId, LabelsSettings>>;

export const labelsPaneStore = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const labelsIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? OPENING;
export const labelsOf = (slot: SlotId) => labelsIn(labelsPaneStore.get(), slot);

// Labels (A–Z) needs labels to sort: without them the pane shows a message in
// place of the rows, with nothing to sweep.
export const labelsMissing = (g: Graph | null, sort: LabelSort) => !!g && sort === "alpha" && !g.hasLabels;

function update(slot: SlotId, patch: Partial<LabelsSettings>) {
  labelsPaneStore.set((s) => ({ bySlot: { ...s.bySlot, [slot]: { ...labelsIn(s, slot), ...patch } } }));
}

export function setLabelSort(slot: SlotId, sort: LabelSort) {
  if (sort !== labelsOf(slot).sort) update(slot, { sort });
}

export function toggleReverse(slot: SlotId) {
  update(slot, { reverse: !labelsOf(slot).reverse });
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
