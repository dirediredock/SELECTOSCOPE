import { createStore } from "./createStore";
import type { PaneType } from "./panes";
import { layout, retyped, typeOf } from "./layout";
import type { SlotId } from "./layout";
import { data } from "../data/dataStore";

// Each slot's zoom and pan, applied on top of its fit-to-pane, about the
// pane's centre c:
//   screen = c + (fitted - c) * k + (tx, ty)
// Centre-relative, so a view stays put when the window (and pane) resizes.
// k = 1 with no pan is "fitted to the pane"; the zoom readout shows k.
export interface Transform {
  k: number;
  tx: number;
  ty: number;
}

export const IDENTITY: Transform = { k: 1, tx: 0, ty: 0 };
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 64;

// The view a pane opens with, and what Fit all restores. NodeLink sits at
// 85%, so the drawing has air around it rather than touching the pane edge.
const HOME: Partial<Record<PaneType, Transform>> = {
  nodelink: { k: 0.85, tx: 0, ty: 0 },
};

export const homeOf = (type: PaneType) => HOME[type] ?? IDENTITY;

export const views = createStore<Partial<Record<SlotId, Transform>>>({});

export const viewIn = (s: Partial<Record<SlotId, Transform>>, slot: SlotId) => s[slot] ?? homeOf(typeOf(slot));
export const viewOf = (slot: SlotId) => viewIn(views.get(), slot);

export function setView(slot: SlotId, t: Transform) {
  views.set({ [slot]: t });
}

// Fit all, from the header's or the strip's zoom percent. A canvas pane fits
// by resetting its transform, and a pane whose fit depends on its content
// listens here too. A counter, so a second fit still notifies when the view
// is already fitted.
export const fitRequests = createStore<Partial<Record<SlotId, number>>>({});

export function fitView(slot: SlotId) {
  homeView(slot);
  fitRequests.set((s) => ({ [slot]: (s[slot] ?? 0) + 1 }));
}

// The home view alone, with no fit request: a pane that fits its own way
// (Cores) is left at home.
export function homeView(slot: SlotId) {
  setView(slot, homeOf(typeOf(slot)));
}

// Zoom by `factor` keeping the cursor fixed. (x, y) is the cursor relative to
// the pane's centre. A fit may sit below ZOOM_MIN (Cores' Fit all on a tall
// pattern); zooming from there never jumps up to it.
export function zoomAt(t: Transform, factor: number, x: number, y: number): Transform {
  const k = Math.min(ZOOM_MAX, Math.max(Math.min(ZOOM_MIN, t.k), t.k * factor));
  const f = k / t.k;
  return { k, tx: x - (x - t.tx) * f, ty: y - (y - t.ty) * f };
}

// The strip's − and + steps: two steps double or halve the zoom.
export const ZOOM_STEP = Math.SQRT2;

// A step about the pane's centre, as the strip's − and + do.
export function zoomBy(slot: SlotId, factor: number) {
  setView(slot, zoomAt(viewOf(slot), factor, 0, 0));
}

// The zoom as the header and the strip show it.
export const zoomLabel = (k: number) => `${Math.round(k * 100)}%`;

// A new dataset is a fresh start: every pane opens fitted. Lists answer the
// fit request too (Labels scrolls to the top).
data.subscribe((s, prev) => {
  if (s.graph !== prev.graph) layout.get().slots.forEach((x) => fitView(x.slot));
});

// A new type opens at its home view, as Fit all does.
layout.subscribe((s, prev) => {
  retyped(s.slots, prev.slots).forEach(fitView);
});
