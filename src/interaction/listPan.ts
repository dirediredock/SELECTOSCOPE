import { interfaceStore } from "../state/interface";
import { clearHover } from "../state/selection";
import { setNavigating } from "./activeGesture";
import { DRAG_START_PX } from "./selectGesture";
import { listWheelSideways } from "./wheel";
import { paneRowStore } from "../state/paneRow";

export interface ListPanOptions {
  // Pan on a plain press, not only with Space held: for a list that doesn't
  // select (Data).
  plainDrag?: boolean;
}

// A drag scrolls a list vertically: the hand tool, shared by the Data and
// Labels lists. In Labels a plain press selects, so only Space + drag scrolls;
// in Data (`plainDrag`) any drag does.
// The pan starts only once the press has moved DRAG_START_PX, and takes the
// pointer only then, so a click still reaches the row under it. The click
// that ends a pan is swallowed, so a drag never acts on a row. The list never
// moves sideways: a sideways wheel or swipe scrolls the pane row in Scroll,
// and does nothing in Fit.
export function attachListPan(
  el: HTMLElement,
  { plainDrag = false }: ListPanOptions = {},
): () => void {
  let press: { pointerId: number; y0: number; lastY: number; panning: boolean } | null = null;
  let swallowClick = false;

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || press) return;
    swallowClick = false;
    if (!plainDrag && !interfaceStore.get().spaceHeld) return;
    // A classic scrollbar belongs to the browser.
    if (e.clientX - el.getBoundingClientRect().left >= el.clientWidth) return;
    press = { pointerId: e.pointerId, y0: e.clientY, lastY: e.clientY, panning: false };
  };

  const onMove = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.pointerId) return;
    if (!press.panning) {
      if (Math.abs(e.clientY - press.y0) < DRAG_START_PX) return;
      press.panning = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
      clearHover();
      setNavigating(true);
    }
    el.scrollTop -= e.clientY - press.lastY;
    press.lastY = e.clientY;
  };

  const onUp = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.pointerId) return;
    if (press.panning) {
      if (el.hasPointerCapture(press.pointerId)) el.releasePointerCapture(press.pointerId);
      el.style.cursor = "";
      setNavigating(false);
      swallowClick = true;
    }
    press = null;
  };

  const onClick = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
  };

  const onWheel = (e: WheelEvent) => {
    if (listWheelSideways(e, paneRowStore.get().mode === "scroll")) e.preventDefault();
  };

  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("click", onClick, true);
  return () => {
    if (press?.panning) {
      el.style.cursor = "";
      setNavigating(false);
    }
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("click", onClick, true);
  };
}
