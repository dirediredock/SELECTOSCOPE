// The one gesture in progress anywhere: a lasso or rectangle in a canvas pane,
// a band in a list, a node drag or a pane resize. Only one runs at a time.

let busy = false;

export const gestureActive = () => busy;

export function beginGesture() {
  busy = true;
}

export function endGesture() {
  busy = false;
}

// A navigation drag (pan, rotate, list scroll) in progress. Hover holds still
// meanwhile, so the red mark doesn't chase items sliding under the cursor.
let navigating = false;

export const isNavigating = () => navigating;

export function setNavigating(on: boolean) {
  navigating = on;
}
