// The one gesture in progress anywhere: a lasso or rectangle in a canvas pane,
// a band in a list, a node drag or a pane resize. Only one runs at a time.

let busy = false;
// How the gesture in progress tears down without committing, if it can.
let abort: (() => void) | null = null;

export const gestureActive = () => busy;

export function beginGesture(onAbort?: () => void) {
  busy = true;
  abort = onAbort ?? null;
}

export function endGesture() {
  busy = false;
  abort = null;
}

// A second finger on a canvas pane turns a lasso or node drag into
// navigation (navigate.ts). Whether no gesture is left running.
export function abortGesture(): boolean {
  if (busy) abort?.();
  return !busy;
}

// A navigation drag (pan, rotate, list scroll) in progress. Hover holds still
// meanwhile, so the red mark doesn't chase items sliding under the cursor.
let navigating = false;

export const isNavigating = () => navigating;

export function setNavigating(on: boolean) {
  navigating = on;
}
