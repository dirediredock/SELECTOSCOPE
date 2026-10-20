import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Key, ReactNode, RefObject, UIEvent } from "react";
import { glideScroll } from "./glideScroll";
import { anchoredScrollTop } from "./listAnchor";
import { scaled } from "../uiScale";

// Row geometry in CSS pixels, from design px (uiScale.ts). Rows sit at content
// y = top + i * pitch; `pad` insets them at the left and bottom, and `padEnd`
// at the right, inside the scrollbar's gutter, which is air enough. It is handed
// to CSS as custom properties, so the stylesheet can't drift from the maths
// the panes hit-test with.
export interface RowGeometry {
  rowHeight: number;
  rowGap: number;
  pad: number;
  padEnd: number;
  top: number;
}

// Pill rows: pills with a small gap, inset from the pane edge, with a
// little more air above the first row. Data and Labels share them.
export const LIST_ROWS: RowGeometry = {
  rowHeight: scaled(26),
  rowGap: scaled(4),
  pad: scaled(16),
  padEnd: 0,
  top: scaled(18),
};

// How long the scrollbar stays after the last scroll.
const SCROLLBAR_IDLE_MS = 1000;

export const pitchOf = (g: RowGeometry) => g.rowHeight + g.rowGap;

interface VirtualListProps {
  rowCount: number;
  geometry: RowGeometry;
  renderRow: (index: number) => ReactNode;
  // Defaults to the index. Key by item when rows reorder, so a row's DOM
  // (and its imperative classes) follows its item.
  rowKey?: (index: number) => Key;
  scrollerRef?: RefObject<HTMLDivElement | null>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  className?: string;
  // Extra content in scrolled (content) coordinates, e.g. a selection band.
  children?: ReactNode;
  // Scrolls this row to the middle, as near as the list's ends allow, each
  // time a new object is passed (the same row again re-centres), gliding
  // there as the panes' marks glide; `smooth: false` goes at once.
  reveal?: { row: number; smooth?: boolean };
  // Rows of their own heights (the Data pane's tiles); by default every
  // row is the geometry's rowHeight.
  rowHeightOf?: (index: number) => number;
}

// A vertically scrolling list of fixed-height rows that renders only the rows
// in view (plus a small overscan), so thousands of rows stay cheap.
export function VirtualList({
  rowCount,
  geometry,
  renderRow,
  rowKey,
  scrollerRef,
  onScroll,
  className,
  children,
  reveal,
  rowHeightOf,
}: VirtualListProps) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = scrollerRef ?? ownRef;
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);
  // The scrollbar shows only while the list scrolls, and a moment after.
  const [scrolling, setScrolling] = useState(false);
  const idleTimer = useRef(0);
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const { rowHeight, rowGap, pad, top } = geometry;
  const pitch = pitchOf(geometry);
  // Each row's content y, plus the end, when rows have their own heights.
  const tops = useMemo(() => {
    if (!rowHeightOf) return null;
    const t = new Float64Array(rowCount + 1);
    t[0] = top;
    for (let i = 0; i < rowCount; i++) t[i + 1] = t[i]! + rowHeightOf(i) + rowGap;
    return t;
  }, [rowHeightOf, rowCount, top, rowGap]);
  const rowTop = (i: number) => (tops ? tops[i]! : top + i * pitch);

  // Rows that change height but not number (a resized Data pane's tiles, an
  // intro rewrapping) keep what is at the view's middle there, as a zoom
  // about the centre does. New rows aren't anchored: their reveal places them.
  const prevTops = useRef(tops);
  useLayoutEffect(() => {
    const prev = prevTops.current;
    prevTops.current = tops;
    if (!prev || !tops || prev.length !== tops.length) return;
    const el = ref.current!;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = Math.min(max, Math.max(0, anchoredScrollTop(prev, tops, el.scrollTop, el.clientHeight)));
    setScrollTop(el.scrollTop);
  }, [tops]);
  const heightOf = (i: number) => (rowHeightOf ? rowHeightOf(i) : rowHeight);
  // The row at content y: the last one starting at or above it.
  const rowAt = (y: number) => {
    if (!tops) return Math.floor((y - top) / pitch);
    let lo = 0, hi = rowCount;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (tops[mid]! <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  // Set the rendered window together with the scroll, so the rows are there
  // on the first paint rather than after the scroll event. A glide stops at a
  // new reveal, or as soon as the user scrolls.
  useLayoutEffect(() => {
    if (reveal === undefined) return;
    const el = ref.current!;
    const { row } = reveal;
    const end = Math.min(
      Math.max(0, el.scrollHeight - el.clientHeight),
      Math.max(0, rowTop(row) - (el.clientHeight - heightOf(row)) / 2),
    );
    setHeight(el.clientHeight);
    const stop = glideScroll(el, end, reveal.smooth);
    // The window follows the scroll event; an instant jump sets it now.
    setScrollTop(el.scrollTop);
    return stop;
  }, [reveal]);
  const overscan = 4;
  const first = Math.max(0, rowAt(scrollTop) - overscan);
  const last = Math.min(rowCount, rowAt(scrollTop + height) + 1 + overscan);
  const rows = [];
  for (let i = first; i < last; i++) {
    rows.push(
      <div
        key={rowKey ? rowKey(i) : i}
        className="vlist-row"
        style={{ top: rowTop(i), height: rowHeightOf ? heightOf(i) : undefined }}
      >
        {renderRow(i)}
      </div>,
    );
  }
  const contentH = rowCount ? rowTop(rowCount) + pad - rowGap : 0;

  return (
    <div
      ref={ref}
      className={`vlist${scrolling ? " is-scrolling" : ""} ${className ?? ""}`}
      style={
        {
          "--row-h": `${rowHeight}px`,
          "--list-pad": `${pad}px`,
          "--list-pad-end": `${geometry.padEnd}px`,
        } as CSSProperties
      }
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
        setScrolling(true);
        clearTimeout(idleTimer.current);
        idleTimer.current = window.setTimeout(() => setScrolling(false), SCROLLBAR_IDLE_MS);
        onScroll?.(e);
      }}
    >
      <div className="vlist-sizer" style={{ height: contentH }}>
        {rows}
        {children}
      </div>
    </div>
  );
}
