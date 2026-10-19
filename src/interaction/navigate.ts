import { ui } from "../state/uiStore";
import { UI_SCALE } from "../uiScale";
import { setView, viewOf, zoomAt } from "../state/views";
import type { SlotId } from "../state/layout";
import { clearHover } from "../state/selection";
import { wheelAction } from "./wheel";
import { setNavigating } from "./activeGesture";

// Navigation in every canvas pane. A plain drag selects (selectGesture.ts),
// so navigating takes the trackpad or the held Space (Figma):
//   Space + drag                 pan, 3D included: the hand moves the picture
//   two-finger scroll / wheel    pan, or rotate in 3D
//   pinch                        zoom at the cursor (Safari's gesture events too)
//   (the zoom percents fit to content)
// Shift+wheel is left to the browser, which scrolls the pane row.

// Safari's trackpad pinch: `scale` is relative to the gesture's start.
interface GestureLike extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

// When the last pinch arrived as a ctrlKey wheel. A browser that sends both
// wheel and gesture events for one pinch must not zoom twice.
let lastPinchWheel = -Infinity;

// A 3D pane turns its content where a 2D pane pans.
export interface Rotator {
  active(): boolean; // whether the pane is showing 3D right now
  by(dx: number, dy: number): void; // a scroll of (dx, dy) screen px
}

export function attachNavigate(el: HTMLElement, slot: SlotId, rotator?: Rotator): () => void {
  let pan: { pointerId: number; x: number; y: number } | null = null;
  let gestureScale = 1;

  const zoomBy = (factor: number, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    const x = (clientX - (r.left + r.width / 2)) / UI_SCALE, y = (clientY - (r.top + r.height / 2)) / UI_SCALE;
    setView(slot, zoomAt(viewOf(slot), factor, x, y));
  };

  // Screen px in, design px to the view (uiScale.ts), so the picture follows
  // the fingers 1:1.
  const panBy = (dx: number, dy: number) => {
    const t = viewOf(slot);
    setView(slot, { k: t.k, tx: t.tx + dx / UI_SCALE, ty: t.ty + dy / UI_SCALE });
  };

  const onWheel = (e: WheelEvent) => {
    const action = wheelAction(e);
    if (action === "row") return;
    e.preventDefault();
    // Lines -> pixels.
    const unit = e.deltaMode === 1 ? 16 : 1;
    if (action === "zoom") {
      lastPinchWheel = e.timeStamp;
      // A pinch sends small deltas, so it is boosted.
      zoomBy(Math.exp(-e.deltaY * unit * 0.01), e.clientX, e.clientY);
      return;
    }
    // The content follows the fingers, as a scrolled page does.
    const dx = -e.deltaX * unit, dy = -e.deltaY * unit;
    if (rotator?.active()) rotator.by(dx, dy);
    else panBy(dx, dy);
  };

  const onGestureStart = (e: Event) => {
    e.preventDefault();
    gestureScale = 1;
  };

  const onGestureChange = (e: Event) => {
    e.preventDefault();
    const g = e as GestureLike;
    const factor = g.scale / gestureScale;
    gestureScale = g.scale;
    if (e.timeStamp - lastPinchWheel < 200) return;
    zoomBy(factor, g.clientX, g.clientY);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || pan) return;
    if (!ui.get().spaceHeld) return; // a selection (selectGesture.ts)
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
    clearHover();
    setNavigating(true);
    pan = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onMove = (e: PointerEvent) => {
    if (!pan || e.pointerId !== pan.pointerId) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    panBy(dx, dy);
    pan.x = e.clientX;
    pan.y = e.clientY;
  };

  const onUp = (e: PointerEvent) => {
    if (!pan || e.pointerId !== pan.pointerId) return;
    if (el.hasPointerCapture(pan.pointerId)) el.releasePointerCapture(pan.pointerId);
    el.style.cursor = "";
    pan = null;
    setNavigating(false);
  };

  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("gesturestart", onGestureStart);
  el.addEventListener("gesturechange", onGestureChange);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  return () => {
    if (pan) setNavigating(false);
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("gesturestart", onGestureStart);
    el.removeEventListener("gesturechange", onGestureChange);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
  };
}

// A pinch anywhere but a canvas pane does nothing: never browser page zoom,
// which would break the fixed-size layout. A canvas pane's own listeners
// (above) run first and zoom it. Cmd+/Cmd- still zoom the page.
export function blockPageZoom(): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  const onGesture = (e: Event) => e.preventDefault();
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("gesturestart", onGesture);
  window.addEventListener("gesturechange", onGesture);
  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("gesturestart", onGesture);
    window.removeEventListener("gesturechange", onGesture);
  };
}
