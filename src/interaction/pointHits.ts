import type { HoverItem } from "../state/selection";
import { lassoMask } from "./lassoMask";

// Hit-testing over items drawn as points, given their screen positions in pane
// CSS pixels ([x0, y0, x1, y1, ...]). Shared by every node-point pane.

// The item* methods answer in the pane's native type. A pane whose marks
// include another type (NodeLink's edge lines) adds pickAt, which hover and
// click use instead of itemAt.
export interface HitTester {
  itemAt(x: number, y: number): number | null;
  itemsInPolygon(poly: number[]): number[];
  itemsInRect(x0: number, y0: number, x1: number, y1: number): number[];
  pickAt?(x: number, y: number): HoverItem | null;
  // The items picked with this one, when a mark stands for several (a
  // Shells pill); hover and click then take them all.
  groupOf?(id: number): readonly number[] | null;
}

// `depth` (larger is nearer) is for 3D: where marks overlap, the one drawn on
// top under the cursor wins, so hover and click take what you see. Shapes
// select through: everything inside them, at any depth.
export function pointHitTester(
  pos: () => Float32Array,
  count: () => number,
  radius: () => number,
  depth: () => Float32Array | null = () => null,
): HitTester {
  return {
    itemAt(x, y) {
      const p = pos();
      const z = depth();
      const r = radius();
      const reach = r + 4;
      const cover = (r + 1) * (r + 1);
      let best: number | null = null;
      let bestD = reach * reach;
      let top: number | null = null;
      let topZ = -Infinity;
      for (let i = 0, n = count(); i < n; i++) {
        const dx = p[2 * i]! - x, dy = p[2 * i + 1]! - y;
        const d = dx * dx + dy * dy;
        if (d <= bestD) {
          bestD = d;
          best = i;
        }
        if (z && d <= cover && z[i]! > topZ) {
          topZ = z[i]!;
          top = i;
        }
      }
      return top ?? best;
    },
    itemsInPolygon(poly) {
      if (poly.length < 6) return [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < poly.length; i += 2) {
        x0 = Math.min(x0, poly[i]!);
        x1 = Math.max(x1, poly[i]!);
        y0 = Math.min(y0, poly[i + 1]!);
        y1 = Math.max(y1, poly[i + 1]!);
      }
      const mask = lassoMask(poly);
      const p = pos();
      const out: number[] = [];
      for (let i = 0, n = count(); i < n; i++) {
        const x = p[2 * i]!, y = p[2 * i + 1]!;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        if (mask.contains(x, y)) out.push(i);
      }
      return out;
    },
    itemsInRect(ax, ay, bx, by) {
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
      const y0 = Math.min(ay, by), y1 = Math.max(ay, by);
      const p = pos();
      const out: number[] = [];
      for (let i = 0, n = count(); i < n; i++) {
        const x = p[2 * i]!, y = p[2 * i + 1]!;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) out.push(i);
      }
      return out;
    },
  };
}

// A HitTester for items drawn as several points each (the matrix draws an
// edge twice, mirrored): point hits come back as item ids, each once.
export function mapHits(h: HitTester, itemOf: () => Uint32Array): HitTester {
  const items = (points: number[]) => {
    const of = itemOf();
    return [...new Set(points.map((i) => of[i]!))];
  };
  return {
    itemAt(x, y) {
      const i = h.itemAt(x, y);
      return i === null ? null : itemOf()[i]!;
    },
    itemsInPolygon: (poly) => items(h.itemsInPolygon(poly)),
    itemsInRect: (x0, y0, x1, y1) => items(h.itemsInRect(x0, y0, x1, y1)),
  };
}

// How far from a line the cursor still reaches it, and how close counts as
// on it (where lines cross in 3D, the nearest in depth among those under
// the cursor wins, as for points).
const EDGE_REACH = 4;
const EDGE_COVER = 2;

// The edge whose straight line (between its endpoints' screen positions) is
// nearest the cursor. `depth` is per node, larger is nearer; an edge's depth
// is its endpoints' mean, the key the renderer sorts it by.
export function edgeAt(
  x: number,
  y: number,
  pos: Float32Array,
  src: Uint32Array,
  tgt: Uint32Array,
  m: number,
  depth: Float32Array | null = null,
): number | null {
  let best: number | null = null;
  let bestD = EDGE_REACH * EDGE_REACH;
  let top: number | null = null;
  let topZ = -Infinity;
  for (let e = 0; e < m; e++) {
    const u = src[e]!, v = tgt[e]!;
    const ax = pos[2 * u]!, ay = pos[2 * u + 1]!;
    const bx = pos[2 * v]!, by = pos[2 * v + 1]!;
    if (Math.min(ax, bx) - EDGE_REACH > x || Math.max(ax, bx) + EDGE_REACH < x) continue;
    if (Math.min(ay, by) - EDGE_REACH > y || Math.max(ay, by) + EDGE_REACH < y) continue;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const ex = ax + t * dx - x, ey = ay + t * dy - y;
    const d = ex * ex + ey * ey;
    if (d <= bestD) {
      bestD = d;
      best = e;
    }
    if (depth && d <= EDGE_COVER * EDGE_COVER) {
      const z = depth[u]! + depth[v]!;
      if (z > topZ) {
        topZ = z;
        top = e;
      }
    }
  }
  return top ?? best;
}

// Node points over edge lines: hover and click take a node where one is in
// reach (nodes are drawn above edges), otherwise an edge. Shapes still take
// nodes only.
export function withEdgePicks(nodes: HitTester, edgeAtCursor: (x: number, y: number) => number | null): HitTester {
  return {
    ...nodes,
    pickAt(x, y) {
      const v = nodes.itemAt(x, y);
      if (v !== null) return { type: "node", id: v };
      const e = edgeAtCursor(x, y);
      return e === null ? null : { type: "edge", id: e };
    },
  };
}
