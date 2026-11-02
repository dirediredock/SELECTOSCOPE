import { interfaceStore } from "../state/interface";
import { UI_SCALE } from "../uiScale";
import { setView, viewOf, zoomAt } from "../state/paneViews";
import type { SlotId } from "../state/paneRow";
import { clearHover } from "../state/hover";
import { wheelAction } from "./wheel";
import { abortGesture, setNavigating } from "./activeGesture";
import { touchFrame } from "./touchFrame";
import type { TouchFrame } from "./touchFrame";

// Navigation in every canvas pane. A plain drag selects (selectGesture.ts),
// so navigating takes the trackpad or the held Space (Figma):
//   Space + drag                 pan, 3D included: the hand moves the picture
//   two-finger scroll / wheel    pan, or rotate in 3D
//   pinch                        zoom at the cursor (Safari's gesture events too)
//   two fingers (touch)          move pans, or rotates in 3D; spread zooms. The
//                                second finger drops the first's lasso unmade
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
  // The fingers on the pane, by pointer; two or more navigate, until all lift.
  const touches = new Map<number, { x: number; y: number }>();
  let frame: TouchFrame | null = null; // while the fingers navigate

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

  const move = (dx: number, dy: number) => {
    if (rotator?.active()) rotator.by(dx, dy);
    else panBy(dx, dy);
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
    move(-e.deltaX * unit, -e.deltaY * unit);
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
    // iOS sends these for fingers on the screen too, which zoom below.
    if (e.timeStamp - lastPinchWheel < 200 || touches.size) return;
    zoomBy(factor, g.clientX, g.clientY);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || pan) return;
    if (!interfaceStore.get().spaceHeld) return; // a selection (selectGesture.ts)
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

  // Capture phase, as a node drag (nodeDrag.ts) keeps the first finger's
  // press from the bubbling listeners.
  const onTouchDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size < 2) return;
    if (!frame) {
      if (!abortGesture()) return; // a pane resize keeps its finger
      clearHover();
      setNavigating(true);
    }
    for (const id of touches.keys()) if (!el.hasPointerCapture(id)) el.setPointerCapture(id);
    frame = touchFrame(touches.values());
  };

  const onTouchMove = (e: PointerEvent) => {
    const p = touches.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!frame) return;
    const next = touchFrame(touches.values());
    move(next.x - frame.x, next.y - frame.y);
    if (frame.spread > 0 && next.spread > 0) zoomBy(next.spread / frame.spread, next.x, next.y);
    frame = next;
  };

  // A finger left behind goes on moving the view alone, never a lasso.
  const onTouchUp = (e: PointerEvent) => {
    if (!touches.delete(e.pointerId) || !frame) return;
    if (touches.size) {
      frame = touchFrame(touches.values());
      return;
    }
    frame = null;
    setNavigating(false);
  };

  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("gesturestart", onGestureStart);
  el.addEventListener("gesturechange", onGestureChange);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerdown", onTouchDown, true);
  el.addEventListener("pointermove", onTouchMove);
  el.addEventListener("pointerup", onTouchUp);
  el.addEventListener("pointercancel", onTouchUp);
  return () => {
    if (pan || frame) setNavigating(false);
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("gesturestart", onGestureStart);
    el.removeEventListener("gesturechange", onGestureChange);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("pointerdown", onTouchDown, true);
    el.removeEventListener("pointermove", onTouchMove);
    el.removeEventListener("pointerup", onTouchUp);
    el.removeEventListener("pointercancel", onTouchUp);
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
