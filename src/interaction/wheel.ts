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
