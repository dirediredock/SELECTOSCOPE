import { focus, interfaceStore } from "../state/interface";
import { paneRowStore } from "../state/paneRow";
import type { SlotId } from "../state/paneRow";
import { AIM, aimStep, makeAim } from "./stripAim";
import type { Aim, Point } from "./stripAim";

// Hover focus in Fit: the pane the pointer enters takes the bottom strip at
// once, except on the way from the focused pane to its controls, where the
// panes crossed never do (stripAim.ts). In Scroll the pane under the row's
// centre has focus (PaneRow), so hover leaves it. While + New is ringed only a
// press focuses, so the upload strip stays put on the way across the panes.
// A drag never hands focus on: it stays with the pane it started in.
//   pointer enters a pane       focus it
//   pointer heads for the strip the panes it crosses wait, faintly gray
//   scroll or pinch over a pane focus it at once
// Presses and keyboard focus focus their pane directly (Pane).
export function attachHoverFocus(): () => void {
  let aim: Aim | null = null;
  // The pointer and the pane under it at the last move.
  let last: Point | null = null;
  let under: SlotId | null = null;
  let restTimer = 0;

  const live = () => paneRowStore.get().mode === "fit" && interfaceStore.get().upload === null;
  const pass = (slot: SlotId | null) => {
    if (interfaceStore.get().passed !== slot) interfaceStore.set({ passed: slot });
  };
  const endAim = () => {
    clearTimeout(restTimer);
    aim = null;
    pass(null);
  };
  const reset = () => {
    endAim();
    last = null;
    under = null;
  };
  const take = (slot: SlotId) => {
    endAim();
    if (live()) focus(slot);
  };

  const onMove = (e: PointerEvent) => {
    if (e.buttons !== 0 || !live()) return reset();
    const p = { x: e.clientX, y: e.clientY };
    const target = e.target instanceof Element ? e.target : null;
    const slot = paneSlot(target);
    const focused = interfaceStore.get().focused;
    const was = under;
    const from = last;
    under = slot;
    last = p;

    if (!aim && from && was !== null && was === focused && slot !== focused) {
      const strip = document.querySelector(".bottombar");
      const controls = strip?.querySelector(".strip-sections");
      if (strip && controls) {
        const { left, right } = controls.getBoundingClientRect();
        aim = makeAim(from, { left, right, top: strip.getBoundingClientRect().top });
      }
    }
    if (aim) {
      // Reaching the strip ends the trip with focus where it was.
      if (target?.closest(".bottombar")) return endAim();
      aim = aimStep(aim, p);
      if (aim) {
        pass(slot !== focused ? slot : null);
        clearTimeout(restTimer);
        restTimer = window.setTimeout(() => {
          // At rest over a gap or the focused pane the trip goes on.
          if (under !== null && under !== interfaceStore.get().focused) take(under);
        }, AIM.rest);
        return;
      }
      endAim();
    }
    if (slot !== null) focus(slot);
  };

  // A scroll or pinch is meant for the pane under it.
  const onNavigate = (e: Event) => {
    if (!live()) return;
    const slot = paneSlot(e.target instanceof Element ? e.target : null);
    if (slot) take(slot);
  };

  const root = document.documentElement;
  window.addEventListener("pointermove", onMove, { capture: true, passive: true });
  window.addEventListener("pointerdown", reset, { capture: true, passive: true });
  window.addEventListener("wheel", onNavigate, { capture: true, passive: true });
  window.addEventListener("gesturestart", onNavigate, { capture: true });
  window.addEventListener("blur", reset);
  root.addEventListener("pointerleave", reset);
  return () => {
    reset();
    window.removeEventListener("pointermove", onMove, { capture: true });
    window.removeEventListener("pointerdown", reset, { capture: true });
    window.removeEventListener("wheel", onNavigate, { capture: true });
    window.removeEventListener("gesturestart", onNavigate, { capture: true });
    window.removeEventListener("blur", reset);
    root.removeEventListener("pointerleave", reset);
  };
}

function paneSlot(el: Element | null): SlotId | null {
  return el?.closest<HTMLElement>(".pane")?.dataset.slot ?? null;
}
