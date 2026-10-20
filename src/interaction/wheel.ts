// Where a wheel event over a canvas pane goes. Pure, so it is unit-tested
// directly (wheel.test.ts).
//   zoom       a pinch (ctrlKey)
//   row        Shift+wheel: left to the browser, which scrolls the pane row
//   navigate   any other scroll: pans a 2D pane, turns a 3D one

type WheelLike = Pick<WheelEvent, "ctrlKey" | "shiftKey">;

export type WheelAction = "zoom" | "navigate" | "row";

export function wheelAction(e: WheelLike): WheelAction {
  if (e.ctrlKey) return "zoom";
  return e.shiftKey ? "row" : "navigate";
}

// A wheel over a list (Data, Labels, Help) that is mostly sideways: swallowed,
// so it neither scrolls the list nor chains to the pane row, Shift+wheel
// included. A pinch (ctrlKey) is left to blockPageZoom.
export function listWheelSideways(e: Pick<WheelEvent, "ctrlKey" | "deltaX" | "deltaY">): boolean {
  return !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY);
}
