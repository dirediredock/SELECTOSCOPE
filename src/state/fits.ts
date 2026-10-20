import type { Transform } from "./views";

// How Fit all fits a tall plot drawn in px at 100% zoom (Shells):
// everything, zoomed out only as far as needed, about the pane's centre, with
// the pattern placed centred at 100% (PointView by "none"). `room` is the
// height it may use, and `roomX` the width.
export function fitAll(height: number, room: number, width = 0, roomX = Infinity): Transform {
  const kx = width > roomX ? roomX / width : 1;
  return { k: Math.min(kx, height > room ? room / height : 1), tx: 0, ty: 0 };
}
