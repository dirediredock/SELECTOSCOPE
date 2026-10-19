import { UI_SCALE } from "../uiScale";

// Match a canvas's backing store to its CSS size at the device pixel ratio,
// clear it, and return a context that draws in design px (see uiScale.ts).
export function sizeCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  const bw = Math.round(r.width * dpr);
  const bh = Math.round(r.height * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const { width, height } = canvasBox(canvas);
  ctx.setTransform(dpr * UI_SCALE, 0, 0, dpr * UI_SCALE, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, w: width, h: height };
}

// An element's size in design px, the units its canvases draw in.
export function canvasBox(el: Element) {
  const r = el.getBoundingClientRect();
  return { width: r.width / UI_SCALE, height: r.height / UI_SCALE };
}

// A pointer's position over an element, in design px.
export function localPoint(el: Element, e: { clientX: number; clientY: number }) {
  const r = el.getBoundingClientRect();
  return [(e.clientX - r.left) / UI_SCALE, (e.clientY - r.top) / UI_SCALE] as const;
}
