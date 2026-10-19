import { scaled } from "../uiScale";

// The Fit row's width arithmetic, in px, on the panes' widths from left to
// right. The row stores shares (see state/layout.ts); these work in px so a
// minimum width means the same on any window.

// The narrowest a pane gets in the Fit row: its header still reads.
export const PANE_MIN_PX = scaled(120);

const sum = (w: readonly number[]) => w.reduce((a, b) => a + b, 0);

// Pane j's widest, from per-pane maximums in px (missing means none).
const cap = (max: readonly number[], j: number) => max[j] ?? Infinity;

// Each pane's share of the row, in proportion to its Scroll ratio, so Fit
// opens in the same proportions as the scrolling row.
export function sharesFromRatios(ars: readonly number[]): number[] {
  const total = sum(ars);
  return ars.map((ar) => ar / total);
}

export function toShares(w: readonly number[]): number[] {
  const total = sum(w);
  return w.map((x) => x / total);
}

// Take up to `amount` px from the panes in `order`, nearest first, none below
// `min`. Returns what was taken.
function take(w: number[], order: readonly number[], amount: number, min: number): number {
  let left = amount;
  for (const j of order) {
    if (left <= 0) break;
    const t = Math.min(left, Math.max(0, w[j] - min));
    w[j] -= t;
    left -= t;
  }
  return amount - left;
}

// The handle between panes i and i + 1, dragged dx px from where it was when
// the drag began (w0). The pane on the side the handle moves away from grows;
// the other side gives the room, nearest pane first, each down to `min`, then
// the handle stops, as it does when the growing pane reaches its `max`.
// **Why from w0:** dragging back undoes a push exactly.
export function dragHandle(
  w0: readonly number[],
  i: number,
  dx: number,
  min: number,
  max: readonly number[] = [],
): number[] {
  const w = [...w0];
  if (dx > 0) {
    const right = w.map((_, j) => j).slice(i + 1);
    w[i] += take(w, right, Math.min(dx, Math.max(0, cap(max, i) - w[i])), min);
  } else if (dx < 0) {
    const left = w.map((_, j) => j).slice(0, i + 1).reverse();
    w[i + 1] += take(w, left, Math.min(-dx, Math.max(0, cap(max, i + 1) - w[i + 1])), min);
  }
  return w;
}

// Double-click on a handle: its two panes share their room evenly, or as
// evenly as a pane's `max` allows.
export function evenPair(w0: readonly number[], i: number, max: readonly number[] = []): number[] {
  const w = [...w0];
  const room = w0[i] + w0[i + 1];
  w[i] = Math.min(room / 2, cap(max, i));
  w[i + 1] = Math.min(room - w[i], cap(max, i + 1));
  w[i] = room - w[i + 1];
  return w;
}

// Pane i at `target` px (a ratio tile in the header menu), within what the
// others' minimums leave. A pane that grows takes from every other pane in
// proportion to its room above `min`; one that shrinks gives to every other
// in proportion to its width.
export function resizeOne(w0: readonly number[], i: number, target: number, min: number): number[] {
  const w = [...w0];
  const total = sum(w0);
  const t = Math.min(total - (w0.length - 1) * min, Math.max(min, target));
  const delta = t - w0[i];
  const others = w0.map((_, j) => j).filter((j) => j !== i);
  if (delta > 0) {
    const slack = sum(others.map((j) => Math.max(0, w0[j] - min)));
    if (slack <= 0) return w;
    for (const j of others) w[j] -= (delta * Math.max(0, w0[j] - min)) / slack;
  } else if (delta < 0) {
    const rest = sum(others.map((j) => w0[j]));
    for (const j of others) w[j] -= (delta * w0[j]) / rest;
  }
  w[i] = t;
  return w;
}
