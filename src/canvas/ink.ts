// The colours a renderer needs, read once per draw from the CSS tokens so both
// themes come for free. Contrast fades the neutral inks of the unselected
// pattern toward the panel; the sets, hover and gesture inks stay full.

import { controlsStore } from "../state/controls";
import { contrastShare, fade } from "./fade";

// Every neutral rule on a canvas (the matrix outline, Shells' enclosures and
// lines, Hops' gridlines) is one `frame`-coloured hairline this wide, px.
export const HAIRLINE = 1;

export interface Ink {
  markNode: string;
  markEdge: string;
  thumbEdge: string; // the Data thumbnails' edges
  node: string; // node set: blue
  edge: string; // edge set: orange
  hover: string; // hovered item: red
  panel: string;
  frame: string; // neutral hairlines
  grid: string; // gridlines: a lighter hairline, since they run through the data
  muted: string; // axis text
  gesture: string;
}

export function readInk(el: Element): Ink {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const panel = v("--panel");
  const share = contrastShare(controlsStore.get().contrast);
  const faded = (name: string) => fade(v(name), panel, share);
  return {
    markNode: faded("--mark-node"),
    markEdge: faded("--mark-edge"),
    thumbEdge: v("--thumb-edge"),
    node: v("--node-sel"),
    edge: v("--edge-sel"),
    hover: v("--hover"),
    panel,
    frame: faded("--edge"),
    grid: faded("--grid"),
    muted: faded("--muted"),
    gesture: v("--text"),
  };
}
