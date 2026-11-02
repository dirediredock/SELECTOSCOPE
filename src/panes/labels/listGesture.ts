import { clearHover, setHover } from "../../state/hover";
import { selectFromNodes, toggleItem } from "../../state/selection";
import type { Mode } from "../../state/selection";
import { controlsStore } from "../../state/controls";
import { interfaceStore } from "../../state/interface";
import { beginGesture, endGesture, gestureActive, isNavigating } from "../../interaction/activeGesture";
import { DRAG_START_PX, nextShapeSwap } from "../../interaction/selectGesture";
import { attachListPan } from "../../interaction/listPan";
import { pitchOf } from "../../components/VirtualList";
import type { RowGeometry } from "../../components/VirtualList";
import { bandRows, rowAt } from "./order";
import { scaled } from "../../uiScale";

// The Labels pane's gestures, the list counterpart of selectGesture:
//   click               toggles the row, as a click does in every pane
//   drag                a band over whole rows, written on release where the
//                       Select mode says; the Rectangle/Lasso tool doesn't
//                       apply
//   Shift / Alt + drag  the band adds / subtracts, as a canvas shape does
//   Space + drag        scroll (interaction/listPan.ts)
//   hover               the row under the cursor, red in every pane
// Rows never move under the cursor: the order holds while the pointer is over
// the list (LabelsPane.tsx).

const EDGE_PX = scaled(28); // auto-scroll zone at the top and bottom while banding
const EDGE_SPEED = scaled(16); // px per frame at the very edge

interface Options {
  el: HTMLDivElement; // the scroller
  band: HTMLDivElement; // the band, inside the scrolled content
  geometry: RowGeometry;
  order: () => Uint32Array; // the order shown
}

export interface ListGesture {
  // Re-hit-test the hover at the last cursor position; call after rows move
  // under a still cursor (scroll, re-sort).
  refreshHover(): void;
  detach(): void;
}

interface Press {
  pointerId: number;
  bandMode: Mode; // replace, or add / subtract with Shift / Alt
  x0: number; // client
  cy0: number; // client
  y0: number; // content
  clientY: number;
  dragging: boolean;
}

export function attachListGesture({ el, band, geometry, order }: Options): ListGesture {
  const pitch = pitchOf(geometry);
  const { top, rowGap } = geometry;
  let cursor: { clientX: number; clientY: number } | null = null;
  let press: Press | null = null;
  let raf = 0;

  const contentY = (clientY: number) => clientY - el.getBoundingClientRect().top + el.scrollTop;
  const idAt = (clientY: number) => {
    const o = order();
    const row = rowAt(contentY(clientY), pitch, top, o.length);
    return row === null ? null : o[row]!;
  };

  const drawBand = (ya: number, yb: number) => {
    const rows = bandRows(ya, yb, pitch, top, order().length);
    // Snapped to the rows it will select; the raw extent where it covers none.
    const y = rows ? top + rows[0] * pitch - rowGap / 2 : Math.min(ya, yb);
    const h = rows ? (rows[1] - rows[0] + 1) * pitch : Math.abs(yb - ya);
    // Its colours, as for a lasso, picked once as it appears.
    if (band.style.display !== "block") {
      band.dataset.mode = controlsStore.get().selectMode;
      band.dataset.swap = nextShapeSwap() ? "1" : "0";
    }
    band.style.display = "block";
    band.style.top = `${y}px`;
    band.style.height = `${h}px`;
  };

  const end = () => {
    if (press && el.hasPointerCapture(press.pointerId)) el.releasePointerCapture(press.pointerId);
    if (press) endGesture();
    press = null;
    band.style.display = "none";
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  // Scroll while the pointer sits near the top or bottom edge mid-band.
  const autoScroll = () => {
    raf = 0;
    if (!press?.dragging) return;
    const r = el.getBoundingClientRect();
    const y = press.clientY;
    const depth = y < r.top + EDGE_PX ? y - (r.top + EDGE_PX) : y > r.bottom - EDGE_PX ? y - (r.bottom - EDGE_PX) : 0;
    if (!depth) return;
    const before = el.scrollTop;
    el.scrollTop += Math.sign(depth) * EDGE_SPEED * Math.min(1, Math.abs(depth) / EDGE_PX);
    if (el.scrollTop === before) return; // hit the end
    drawBand(press.y0, contentY(y));
    raf = requestAnimationFrame(autoScroll);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || press || gestureActive()) return;
    if (interfaceStore.get().spaceHeld) return; // scrolling (listPan.ts)
    // A classic scrollbar belongs to the browser.
    if (e.clientX - el.getBoundingClientRect().left >= el.clientWidth) return;
    el.setPointerCapture(e.pointerId);
    clearHover();
    press = {
      pointerId: e.pointerId,
      bandMode: e.shiftKey ? "add" : e.altKey ? "subtract" : "replace",
      x0: e.clientX,
      cy0: e.clientY,
      y0: contentY(e.clientY),
      clientY: e.clientY,
      dragging: false,
    };
    beginGesture();
  };

  const onMove = (e: PointerEvent) => {
    cursor = { clientX: e.clientX, clientY: e.clientY };
    if (!press) {
      if (e.buttons === 0 && !isNavigating()) setHover("node", idAt(e.clientY));
      return;
    }
    if (e.pointerId !== press.pointerId) return;
    press.clientY = e.clientY;
    if (!press.dragging && Math.hypot(e.clientX - press.x0, e.clientY - press.cy0) < DRAG_START_PX) return;
    press.dragging = true;
    drawBand(press.y0, contentY(e.clientY));
    if (!raf) raf = requestAnimationFrame(autoScroll);
  };

  const onUp = (e: PointerEvent) => {
    const p = press;
    if (!p || e.pointerId !== p.pointerId) return;
    const o = order();
    if (p.dragging) {
      const rows = bandRows(p.y0, contentY(e.clientY), pitch, top, o.length);
      selectFromNodes(controlsStore.get().selectMode, rows ? Array.from(o.subarray(rows[0], rows[1] + 1)) : [], p.bandMode);
    } else {
      const row = rowAt(p.y0, pitch, top, o.length);
      if (row !== null) toggleItem("node", o[row]!);
    }
    end();
    // Show the hover again for whatever is under the cursor now.
    onMove(e);
  };

  const onLeave = () => {
    cursor = null;
    if (!press) clearHover();
  };

  const refreshHover = () => {
    if (!cursor || press || isNavigating()) return;
    setHover("node", idAt(cursor.clientY));
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", onLeave);
  const detachPan = attachListPan(el);
  const detach = () => {
    if (press) end();
    detachPan();
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", end);
    el.removeEventListener("pointerleave", onLeave);
    };
  return { refreshHover, detach };
}
