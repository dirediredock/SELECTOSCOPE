import { createStore } from "./createStore";
import type { PaneType } from "./panes";
import { typeOf } from "./paneRow";
import type { SlotId } from "./paneRow";

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

export const paneViewsStore = createStore<Partial<Record<SlotId, Transform>>>({});

export const viewIn = (s: Partial<Record<SlotId, Transform>>, slot: SlotId) => s[slot] ?? homeOf(typeOf(slot));
export const viewOf = (slot: SlotId) => viewIn(paneViewsStore.get(), slot);

export function setView(slot: SlotId, t: Transform) {
  paneViewsStore.set({ [slot]: t });
}

// The home view alone, with no fit request: a pane that fits its own way
// (Shells) is left at home.
export function homeView(slot: SlotId) {
  setView(slot, homeOf(typeOf(slot)));
}

// Zoom by `factor` keeping the cursor fixed. (x, y) is the cursor relative to
// the pane's centre. A fit may sit below ZOOM_MIN (Shells' Fit all on a tall
// pattern); zooming from there never jumps up to it.
export function zoomAt(t: Transform, factor: number, x: number, y: number): Transform {
  const k = Math.min(ZOOM_MAX, Math.max(Math.min(ZOOM_MIN, t.k), t.k * factor));
  const f = k / t.k;
  return { k, tx: x - (x - t.tx) * f, ty: y - (y - t.ty) * f };
}

// The strip's − and + step the zoom to the next multiple of 5% that way, about
// the pane's centre: 100% to 105%, a pinched 87% to 90% or 85%.
export const ZOOM_STEP = 0.05;

export function zoomStepped(k: number, dir: 1 | -1): number {
  const at = k / ZOOM_STEP;
  // A zoom a hair off a multiple (float error) counts as on it.
  const next = dir > 0 ? Math.floor(at + 1e-6) + 1 : Math.ceil(at - 1e-6) - 1;
  return Math.max(1, next) * ZOOM_STEP;
}

export function zoomStep(slot: SlotId, dir: 1 | -1) {
  const t = viewOf(slot);
  setView(slot, zoomAt(t, zoomStepped(t.k, dir) / t.k, 0, 0));
}

// The zoom as the header and the strip show it.
export const zoomLabel = (k: number) => `${Math.round(k * 100)}%`;
