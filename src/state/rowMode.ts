// Which row the window gets, from its shape alone. A landscape window shares
// its width among the panes (Fit); a portrait one is too narrow for that, so
// the panes keep their shapes at full height and the row scrolls (Scroll).
// Between the two thresholds the row keeps the mode it has, so a window
// dragged across square doesn't flip back and forth.

export type RowMode = "fit" | "scroll";

// Width / height below which the row scrolls, and above which it fits.
export const SCROLL_BELOW = 0.95;
export const FIT_ABOVE = 1.05;

// `prev` null is a fresh load: inside the band it opens in Fit.
export function rowModeFor(prev: RowMode | null, w: number, h: number): RowMode {
  const aspect = w / h;
  if (aspect < SCROLL_BELOW) return "scroll";
  if (aspect > FIT_ABOVE) return "fit";
  return prev ?? "fit";
}

// The mode for the window as it is now (Fit where there is no window, as in
// the tests).
export function windowRowMode(prev: RowMode | null): RowMode {
  return typeof window === "undefined" ? "fit" : rowModeFor(prev, window.innerWidth, window.innerHeight);
}
