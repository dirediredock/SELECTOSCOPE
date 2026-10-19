import { createStore } from "./createStore";
import { PANES } from "./panes";
import type { PaneType } from "./panes";

// The line-up: which pane type sits in each slot, and at what ratio. A slot is
// one place in the row. Its id never changes, so per-pane view state (zoom,
// pan, NodeLink view, matrix seriation, ...) is keyed by slot, and two slots
// can show the same type with their own settings. The selection stays global.
//
// The panes share the window's width, resized by dragging between them, and
// each keeps its share of the row. A slot's ratio only sets its opening
// share.

export type SlotId = string;

export interface Slot {
  slot: SlotId;
  type: PaneType;
  ar: number;
}

export interface LayoutState {
  slots: readonly Slot[];
  // Each slot's share of the Fit row, summing to 1. Null until the first
  // resize, and then the row takes its proportions from the ratios. They last
  // the session, so Fit comes back as it was left.
  shares: Readonly<Record<SlotId, number>> | null;
}

export const layout = createStore<LayoutState>({
  slots: PANES.map((p, i) => ({ slot: `s${i}`, type: p.id, ar: p.ar })),
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

// The Fit row's shares, one per slot in line-up order.
export function setShares(shares: readonly number[]) {
  layout.set((s) => ({ shares: Object.fromEntries(s.slots.map((x, i) => [x.slot, shares[i]])) }));
}

// Slots whose type changed between two line-ups.
export function retyped(s: readonly Slot[], prev: readonly Slot[]): SlotId[] {
  return s.filter((x) => prev.find((p) => p.slot === x.slot)?.type !== x.type).map((x) => x.slot);
}
