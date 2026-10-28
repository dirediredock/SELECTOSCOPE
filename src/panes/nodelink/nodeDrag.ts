import { localPoint } from "../../canvas/sizeCanvas";
import type { PointView } from "../../canvas/pointView";
import type { HitTester } from "../../interaction/pointHits";
import { DRAG_START_PX } from "../../interaction/selectGesture";
import { beginGesture, endGesture, gestureActive, isNavigating, setNavigating } from "../../interaction/activeGesture";
import { selectionStore, setHover, toggleItem } from "../../state/selection";
import { sweepRunStore } from "../../state/sweep";
import { interfaceStore } from "../../state/interface";
import type { LiveSim } from "./live";

// Dragging a node in the Interactive view (Figma: a drag on an object moves it; a
// lasso starts on empty space). It claims a plain press on a node before
// navigate.ts and selectGesture.ts see it; a press with Alt (a subtracting
// lasso) or with Space held (navigation) passes it by.
// Shift + press on a node in the node set moves the whole set with it,
// rigidly. Anywhere else Shift is the adding lasso, so it only steals presses
// on blue nodes; during a sweep the set isn't drawn, so it is the lasso there too.
// A press that never travels is a click, which toggles the node, as
// everywhere. The node stays hovered (red in every pane) while held.

interface Options {
  el: HTMLElement; // the pane stack, which receives the pointer events
  view: PointView; // screen <-> layout units
  hit: () => HitTester | null;
  sim: () => LiveSim | null; // null outside the Interactive view
}

interface Held {
  pointerId: number;
  node: number;
  sim: LiveSim;
  x0: number;
  y0: number;
  // The node's centre minus the pointer, so the node doesn't jump to it.
  dx: number;
  dy: number;
  group: number[] | null; // the node set at the press, for a Shift move
  dragging: boolean;
}

export function attachNodeDrag({ el, view, hit, sim }: Options): () => void {
  let held: Held | null = null;

  const local = (e: PointerEvent) => localPoint(el, e);

  const nodeAt = (x: number, y: number) => (sim() ? (hit()?.itemAt(x, y) ?? null) : null);

  // Inline, over the pane's own cursor (grab or crosshair, from its state).
  const setCursor = (c: "" | "grab" | "grabbing") => {
    if (el.style.cursor !== c) el.style.cursor = c;
  };

  const end = () => {
    const h = held;
    if (!h) return;
    held = null;
    if (h.dragging) h.sim.release();
    if (el.hasPointerCapture(h.pointerId)) el.releasePointerCapture(h.pointerId);
    setNavigating(false);
    endGesture();
    setCursor("grab");
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary || e.altKey || interfaceStore.get().spaceHeld || held || gestureActive()) return;
    const s = sim();
    const [x, y] = local(e);
    const v = nodeAt(x, y);
    if (!s || v === null) return;
    const set = selectionStore.get().nodes;
    if (e.shiftKey && (!set.has(v) || sweepRunStore.get().slot !== null)) return;
    e.stopPropagation(); // the press is ours, not a pan or a lasso
    el.setPointerCapture(e.pointerId);
    held = {
      pointerId: e.pointerId,
      node: v,
      sim: s,
      x0: x,
      y0: y,
      dx: view.pos[2 * v]! - x,
      dy: view.pos[2 * v + 1]! - y,
      group: e.shiftKey ? [...set] : null,
      dragging: false,
    };
    setHover("node", v);
    setNavigating(true);
    beginGesture(end); // a second finger: the node is let go where it is
  };

  const onMove = (e: PointerEvent) => {
    const [x, y] = local(e);
    if (!held) {
      if (e.buttons !== 0 || isNavigating() || gestureActive()) return;
      setCursor(nodeAt(x, y) === null ? "" : "grab");
      return;
    }
    if (e.pointerId !== held.pointerId) return;
    if (!held.dragging) {
      if (Math.hypot(x - held.x0, y - held.y0) < DRAG_START_PX) return;
      held.dragging = true;
      held.sim.grab(held.node, held.group ?? undefined);
      setCursor("grabbing");
    }
    const [lx, ly] = view.unproject(x + held.dx, y + held.dy);
    held.sim.dragTo(lx, ly);
  };

  const onUp = (e: PointerEvent) => {
    if (!held || e.pointerId !== held.pointerId) return;
    if (!held.dragging) toggleItem("node", held.node);
    end();
  };

  const onLeave = () => {
    if (!held) setCursor("");
  };

  // Capture phase: the pane's other gestures listen on the same element.
  el.addEventListener("pointerdown", onDown, true);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", onLeave);
  return () => {
    end();
    el.removeEventListener("pointerdown", onDown, true);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", end);
    el.removeEventListener("pointerleave", onLeave);
  };
}
