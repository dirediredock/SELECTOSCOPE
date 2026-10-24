import { localPoint, sizeCanvas } from "../canvas/sizeCanvas";
import { clearHover, selectFromEdges, selectFromNodes, setHover, toggleGroup, toggleItem } from "../state/selection";
import type { HoverItem, ItemType, Mode } from "../state/selection";
import { ui } from "../state/uiStore";
import type { Tool } from "../state/uiStore";
import type { HitTester } from "./pointHits";
import { lassoMask, OUTSIDE } from "./lassoMask";
import { beginGesture, endGesture, gestureActive, isNavigating } from "./activeGesture";

// The selection gesture, shared by every pane that selects by drawing. A drag
// selects in any pane; with Space held, it navigates instead (navigate.ts).
//   drag         lasso / rectangle (the global tool); replaces the selection,
//                and clears it when the shape covers nothing
//   Shift + drag adds what the shape covers (Photoshop)
//   Alt + drag   subtracts it
//   click        toggle the item under the cursor (or its group, see
//                HitTester.groupOf); empty space does nothing
//   hover        the item under the cursor turns red in every pane
// The pane supplies a HitTester in its own screen space; this module knows
// nothing about how the pane draws. Shapes write where the Select mode says;
// in Nodes mode a pane may take nodes its own way (the matrix's columns,
// HitTester.nodesInRect). Hover and click take any item the pane can pick
// (NodeLink's edge lines too), whatever the mode.

// Large enough that a shaky click never becomes an empty lasso, which would
// clear the selection with no undo. Shared with the list band.
export const DRAG_START_PX = 6;

interface Active {
  pointerId: number;
  tool: Tool;
  mode: Mode; // replace, or add / subtract with Shift / Alt
  x0: number;
  y0: number;
  x: number;
  y: number;
  pts: number[];
  dragging: boolean;
  swap: boolean; // in Both: which set's colour dashes, which fills
  end: () => void; // the owning pane's end, since `active` is shared
}

let active: Active | null = null;

// In Both, a shape pairs one set's colour on its dashes with the other's fill,
// and each new shape, in any pane, takes the other pairing from the last.
let swapNext = false;
export function nextShapeSwap(): boolean {
  swapNext = !swapNext;
  return !swapNext;
}

// The lasso's fill is its enclosure mask (lassoMask.ts), tinted on a scratch
// canvas, so loops where it crosses itself fill as they select: no holes.
let scratch: HTMLCanvasElement | null = null;
function fillLasso(ctx: CanvasRenderingContext2D, pts: number[], colour: string) {
  const m = lassoMask(pts);
  if (!m.w || !m.h) return;
  scratch ??= document.createElement("canvas");
  scratch.width = m.w;
  scratch.height = m.h;
  const sc = scratch.getContext("2d")!;
  const img = sc.createImageData(m.w, m.h);
  for (let i = 0; i < m.cells.length; i++) if (m.cells[i] !== OUTSIDE) img.data[4 * i + 3] = 255;
  sc.putImageData(img, 0, 0);
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = colour;
  sc.fillRect(0, 0, m.w, m.h);
  ctx.drawImage(scratch, m.x0, m.y0, m.w * m.scale, m.h * m.scale);
}

interface Options {
  el: HTMLElement; // receives the pointer events
  overlay: HTMLCanvasElement; // draws the lasso / rectangle
  type: ItemType; // the pane's native type
  hit: () => HitTester | null; // null while the pane has no data
}

export interface SelectGesture {
  // Re-hit-test the hover at the last cursor position; call after the view
  // moves under a still cursor (zoom, pan, resize).
  refreshHover(): void;
  detach(): void;
}

export function attachSelectGesture({ el, overlay, type, hit }: Options): SelectGesture {
  let cursor: { clientX: number; clientY: number } | null = null;
  const local = (e: { clientX: number; clientY: number }) => localPoint(el, e);

  const pick = (h: HitTester, x: number, y: number): HoverItem | null => {
    if (h.pickAt) return h.pickAt(x, y);
    const id = h.itemAt(x, y);
    if (id === null) return null;
    const group = h.groupOf?.(id);
    return group ? { type, id, group } : { type, id };
  };

  const hoverAt = (h: HitTester, x: number, y: number) => {
    const item = pick(h, x, y);
    if (item) setHover(item.type, item.id, item.group);
    else clearHover();
  };

  const drawShape = (g: Active) => {
    const { ctx } = sizeCanvas(overlay);
    ctx.beginPath();
    if (g.tool === "rect") {
      ctx.rect(Math.min(g.x0, g.x), Math.min(g.y0, g.y), Math.abs(g.x - g.x0), Math.abs(g.y - g.y0));
    } else {
      ctx.moveTo(g.pts[0]!, g.pts[1]!);
      for (let i = 2; i < g.pts.length; i += 2) ctx.lineTo(g.pts[i]!, g.pts[i + 1]!);
      ctx.closePath();
    }
    // The shape takes the colours of the set(s) the Select mode says it will
    // write: blue for nodes, orange for edges. Both pairs one colour's dashes
    // with the other's fill, alternating shape by shape, as neither set comes
    // first.
    const css = getComputedStyle(overlay);
    const blue = css.getPropertyValue("--node-sel").trim();
    const orange = css.getPropertyValue("--edge-sel").trim();
    const mode = ui.get().selectMode;
    const [line, fill] =
      mode === "node" ? [blue, blue] : mode === "edge" ? [orange, orange] : g.swap ? [orange, blue] : [blue, orange];
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = fill;
    if (g.tool === "rect") ctx.fill();
    else fillLasso(ctx, g.pts, fill);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
  };

  const end = () => {
    if (active && el.hasPointerCapture(active.pointerId)) el.releasePointerCapture(active.pointerId);
    active = null;
    endGesture();
    sizeCanvas(overlay);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || gestureActive()) return;
    if (ui.get().spaceHeld) return; // navigation (navigate.ts)
    if (!hit()) return;
    const [x, y] = local(e);
    el.setPointerCapture(e.pointerId);
    clearHover();
    active = {
      pointerId: e.pointerId,
      tool: ui.get().tool,
      mode: e.shiftKey ? "add" : e.altKey ? "subtract" : "replace",
      swap: nextShapeSwap(),
      x0: x,
      y0: y,
      x,
      y,
      pts: [x, y],
      dragging: false,
      end,
    };
    beginGesture();
  };

  const onMove = (e: PointerEvent) => {
    cursor = { clientX: e.clientX, clientY: e.clientY };
    const [x, y] = local(e);
    if (!active) {
      const h = hit();
      if (h && e.buttons === 0 && !isNavigating()) hoverAt(h, x, y);
      return;
    }
    if (e.pointerId !== active.pointerId) return;
    const g = active;
    g.x = x;
    g.y = y;
    if (!g.dragging && Math.hypot(x - g.x0, y - g.y0) < DRAG_START_PX) return;
    g.dragging = true;
    const lx = g.pts[g.pts.length - 2]!, ly = g.pts[g.pts.length - 1]!;
    if (Math.hypot(x - lx, y - ly) >= 1.5) g.pts.push(x, y);
    drawShape(g);
  };

  const onUp = (e: PointerEvent) => {
    const g = active;
    if (!g || e.pointerId !== g.pointerId) return;
    const h = hit();
    if (h) {
      if (g.dragging) {
        const target = ui.get().selectMode;
        if (target === "node" && h.nodesInRect && h.nodesInPolygon) {
          // The pane's own way to nodes (the matrix's columns).
          const ids = g.tool === "rect" ? h.nodesInRect(g.x0, g.y0, g.x, g.y) : h.nodesInPolygon(g.pts);
          selectFromNodes(target, ids, g.mode);
        } else {
          const ids = g.tool === "rect" ? h.itemsInRect(g.x0, g.y0, g.x, g.y) : h.itemsInPolygon(g.pts);
          // Nodes and edges alike go where the Select mode says.
          if (type === "node") selectFromNodes(target, ids, g.mode);
          else selectFromEdges(target, ids, g.mode);
        }
      } else {
        const item = pick(h, g.x0, g.y0);
        if (item?.group) toggleGroup(item.type, item.group);
        else if (item) toggleItem(item.type, item.id);
      }
    }
    end();
    // Show the hover again for whatever is under the cursor now.
    onMove(e);
  };

  const onLeave = () => {
    cursor = null;
    if (!active) clearHover();
  };

  const refreshHover = () => {
    const h = hit();
    if (!cursor || active || !h || isNavigating()) return;
    const [x, y] = local(cursor);
    hoverAt(h, x, y);
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", onLeave);
  const detach = () => {
    if (active?.end === end) end();
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", end);
    el.removeEventListener("pointerleave", onLeave);
  };
  return { refreshHover, detach };
}
