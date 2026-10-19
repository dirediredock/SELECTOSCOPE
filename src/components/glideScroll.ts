import { easeInOut, GLIDE_MS } from "../canvas/glide";

// Scrolls `el` to `end`, gliding as the panes' marks glide; at once under
// reduced motion or when already there. A wheel or a press stops the glide,
// so the user takes over at once. Returns a stop for the caller's cleanup.
export function glideScroll(el: HTMLElement, end: number, smooth = true): () => void {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!smooth || still || Math.abs(el.scrollTop - end) < 1) {
    el.scrollTop = end;
    return () => {};
  }
  const from = el.scrollTop;
  const start = performance.now();
  let frame = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - start) / GLIDE_MS);
    el.scrollTop = from + (end - from) * easeInOut(t);
    if (t < 1) frame = requestAnimationFrame(step);
  });
  const stop = () => {
    cancelAnimationFrame(frame);
    el.removeEventListener("wheel", stop);
    el.removeEventListener("pointerdown", stop);
  };
  el.addEventListener("wheel", stop, { passive: true });
  el.addEventListener("pointerdown", stop);
  return stop;
}
