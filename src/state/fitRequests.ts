import { createStore } from "./createStore";
import { paneInfo } from "./panes";
import { paneRowStore, retyped } from "./paneRow";
import type { SlotId } from "./paneRow";
import { homeView } from "./paneViews";
import { datasetStore } from "./dataset";

// Fit all, from the header's or the strip's zoom percent. A canvas pane fits
// by resetting its transform, and a pane whose fit depends on its content
// listens here too. A counter, so a second fit still notifies when the view
// is already fitted.
export const fitRequestsStore = createStore<Partial<Record<SlotId, number>>>({});

export function fitView(slot: SlotId) {
  homeView(slot);
  fitRequestsStore.set((s) => ({ [slot]: (s[slot] ?? 0) + 1 }));
}

// A new dataset is a fresh start: every pane opens fitted. Lists answer the
// fit request too (Labels scrolls to the top).
datasetStore.subscribe((s, prev) => {
  if (s.graph !== prev.graph) paneRowStore.get().slots.forEach((x) => fitView(x.slot));
});

// A new type opens at its home view, as Fit all does. A new row mode refits
// every canvas pane (lists keep their scroll), and a new Scroll ratio its pane.
paneRowStore.subscribe((s, prev) => {
  if (s.mode !== prev.mode) s.slots.filter((x) => !paneInfo(x.type).list).forEach((x) => fitView(x.slot));
  retyped(s.slots, prev.slots).forEach(fitView);
  s.slots.forEach((x) => {
    const p = prev.slots.find((q) => q.slot === x.slot);
    if (p && p.type === x.type && p.ar !== x.ar) fitView(x.slot);
  });
});
