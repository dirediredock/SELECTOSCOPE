import { layout, setShares, setSlotAr } from "../state/layout";
import type { SlotId } from "../state/layout";
import { PANE_MIN_PX, resizeOne, toShares } from "./paneWidths";

// The Fit row as drawn: its panes left to right, and their widths in px.

export const rowPanes = () => Array.from(document.querySelectorAll<HTMLElement>(".panes > .pane"));

export const widthsOf = (panes: readonly HTMLElement[]) => panes.map((p) => p.getBoundingClientRect().width);

// Each pane's widest in px, as the stylesheet caps it (Infinity for none).
export const maxWidthsOf = (panes: readonly HTMLElement[]) =>
  panes.map((p) => parseFloat(getComputedStyle(p).maxWidth) || Infinity);

// A shape tile in the Fit row: the pane takes the width `widthAt` gives for
// its height, and the other panes make the room.
export function fitSlotToWidth(slot: SlotId, widthAt: (h: number) => number) {
  const panes = rowPanes();
  const i = panes.findIndex((p) => p.dataset.slot === slot);
  if (i < 0) return;
  const h = panes[i].getBoundingClientRect().height;
  setShares(toShares(resizeOne(widthsOf(panes), i, widthAt(h), PANE_MIN_PX)));
}

// A header menu tile, in either row: `ar` null is the minimum width. In Fit
// the pane takes that width in the row; in Scroll it becomes the slot's
// ratio.
export function setSlotShape(slot: SlotId, ar: number | null) {
  if (layout.get().mode === "fit") fitSlotToWidth(slot, (h) => (ar === null ? PANE_MIN_PX : ar * h));
  else setSlotAr(slot, ar);
}
