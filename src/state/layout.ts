import { createStore } from "./createStore";
import { PANES, SCROLL_OPENING_AR } from "./panes";
import type { PaneType } from "./panes";
import { windowRowMode } from "./rowMode";
import type { RowMode } from "./rowMode";

// The line-up: which pane type sits in each slot, and at what ratio. A slot is
// one place in the row. Its id never changes, so per-pane view state (zoom,
// pan, NodeLink view, matrix seriation, ...) is keyed by slot, and two slots
// can show the same type with their own settings. The selection stays global.
//
// The row has two modes, picked by the window's shape (rowMode.ts). Fit, in a
// landscape window: the panes share the window's width, resized by dragging
// between them, and each keeps its share of the row. Scroll, in a portrait
// one: each pane is the row's height at its slot's ratio, and the row scrolls
// sideways. The shares are Fit's and the ratios Scroll's, so neither mode
// ever changes the other.

export type SlotId = string;

export interface Slot {
  slot: SlotId;
  type: PaneType;
  // The Scroll ratio, width / height; null is the row's minimum width.
  ar: number | null;
}

export interface LayoutState {
  slots: readonly Slot[];
  mode: RowMode;
  // Each slot's share of the Fit row, summing to 1. Null until the first
  // resize, and then the row takes its proportions from the pane types'
  // default ratios. They last the session, so Fit comes back as it was left.
  shares: Readonly<Record<SlotId, number>> | null;
}

export const layout = createStore<LayoutState>({
  slots: PANES.map((p, i) => ({ slot: `s${i}`, type: p.id, ar: SCROLL_OPENING_AR })),
  mode: windowRowMode(null),
  shares: null,
});

export const slotOf = (slot: SlotId) => layout.get().slots.find((s) => s.slot === slot)!;
export const typeOf = (slot: SlotId) => slotOf(slot).type;

function update(slot: SlotId, patch: Partial<Slot>) {
  layout.set((s) => ({ slots: s.slots.map((x) => (x.slot === slot ? { ...x, ...patch } : x)) }));
}

// A new type starts from its home view and default settings (views.ts,
// nodelink.ts and matrix.ts listen here).
export function setSlotType(slot: SlotId, type: PaneType) {
  if (typeOf(slot) !== type) update(slot, { type });
}

// A new Scroll ratio refits the pane, as Fit all does (views.ts).
export function setSlotAr(slot: SlotId, ar: number | null) {
  if (slotOf(slot).ar !== ar) update(slot, { ar });
}

// Follow the window's shape. A new mode refits every canvas pane (views.ts).
export function watchRowMode() {
  const onResize = () => {
    const mode = windowRowMode(layout.get().mode);
    if (mode !== layout.get().mode) layout.set({ mode });
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

// The Fit row's shares, one per slot in line-up order.
export function setShares(shares: readonly number[]) {
  layout.set((s) => ({ shares: Object.fromEntries(s.slots.map((x, i) => [x.slot, shares[i]])) }));
}

// Slots whose type changed between two line-ups.
export function retyped(s: readonly Slot[], prev: readonly Slot[]): SlotId[] {
  return s.filter((x) => prev.find((p) => p.slot === x.slot)?.type !== x.type).map((x) => x.slot);
}
