// Where to scroll so the content at the view's middle stays there when rows
// change height (a narrower or wider Data pane resizes its tiles). `tops` are
// VirtualList's row starts, one more than the rows: the last is the end.
// Pure, so it is unit-tested directly (listAnchor.test.ts). The caller clamps
// the result to the scroll range.
export function anchoredScrollTop(
  oldTops: ArrayLike<number>,
  newTops: ArrayLike<number>,
  scrollTop: number,
  viewH: number,
): number {
  const n = oldTops.length - 1;
  const mid = scrollTop + viewH / 2;
  // In the inset above the first row, which never changes height.
  if (n < 1 || mid < oldTops[0]!) return scrollTop;
  // Past the last row: keep the same distance from the end.
  if (mid >= oldTops[n]!) return newTops[n]! + (mid - oldTops[n]!) - viewH / 2;
  // The last row starting at or above the middle, and how far through it.
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (oldTops[m]! <= mid) lo = m;
    else hi = m - 1;
  }
  const f = (mid - oldTops[lo]!) / (oldTops[lo + 1]! - oldTops[lo]!);
  return newTops[lo]! + f * (newTops[lo + 1]! - newTops[lo]!) - viewH / 2;
}
