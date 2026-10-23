import type { PointView } from "../../canvas/pointView";
import { lassoMask, OUTSIDE } from "../../interaction/lassoMask";
import { columnsInQuad } from "./geometry";

// What a Nodes-mode shape takes in the Matrix: the nodes whose columns it
// crosses, empty cells included, so a shape over a block picks one side of it.
// A rectangle is one quad; a lasso is its enclosure mask (lassoMask.ts), the
// fill it shows, read a run of cells at a time, so columns narrower than a
// cell are still taken whole.

interface ColumnScene {
  view: PointView;
  pose: number;
  order: Uint32Array; // position -> node_id
}

export function columnHits(scene: () => ColumnScene | null) {
  // The columns crossed by screen rectangles, as node ids.
  const take = (rects: Iterable<[number, number, number, number]>): number[] => {
    const s = scene();
    if (!s) return [];
    const n = s.order.length;
    const crossed = new Uint8Array(n);
    for (const [x0, y0, x1, y1] of rects) {
      const quad = [
        ...s.view.unproject(x0, y0),
        ...s.view.unproject(x1, y0),
        ...s.view.unproject(x1, y1),
        ...s.view.unproject(x0, y1),
      ];
      const span = columnsInQuad(quad, s.pose, n);
      if (span) crossed.fill(1, span[0], span[1] + 1);
    }
    const out: number[] = [];
    for (let c = 0; c < n; c++) if (crossed[c]) out.push(s.order[c]!);
    return out;
  };

  function* runs(poly: number[]): Generator<[number, number, number, number]> {
    const m = lassoMask(poly);
    for (let y = 0; y < m.h; y++) {
      let start = -1;
      for (let x = 0; x <= m.w; x++) {
        const inside = x < m.w && m.cells[y * m.w + x] !== OUTSIDE;
        if (inside && start < 0) start = x;
        else if (!inside && start >= 0) {
          const top = m.y0 + y * m.scale;
          yield [m.x0 + start * m.scale, top, m.x0 + x * m.scale, top + m.scale];
          start = -1;
        }
      }
    }
  }

  return {
    nodesInPolygon: (poly: number[]) => (poly.length < 6 ? [] : take(runs(poly))),
    nodesInRect: (x0: number, y0: number, x1: number, y1: number) => take([[x0, y0, x1, y1]]),
  };
}
