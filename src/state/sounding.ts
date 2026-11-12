import { createStore } from "./createStore";
import type { Ink } from "../canvas/ink";

// The marks that sounded at the sweep's last step (audio/sweepSonify.ts),
// shown red in every pane at a selected mark's weight, under the hovered
// item. Sounding edges bring their endpoints, so a pane that draws only nodes
// shows them too. Empty unless the sweep's sound is on.

const NONE: ReadonlySet<number> = new Set();

export const soundingStore = createStore<{ nodes: ReadonlySet<number>; edges: ReadonlySet<number> }>({ nodes: NONE, edges: NONE });

export function setSounding(nodes: Iterable<number>, edges: Iterable<number>) {
  const n = new Set(nodes), e = new Set(edges);
  const now = soundingStore.get();
  // Still silent: the same empty sets, so no pane redraws.
  if (!n.size && !e.size && !now.nodes.size && !now.edges.size) return;
  soundingStore.set({ nodes: n.size ? n : NONE, edges: e.size ? e : NONE });
}

// The panes' set painters draw the sounding marks, in the hover's red.
export const soundingInk = (ink: Ink): Ink => ({ ...ink, node: ink.hover, edge: ink.hover });
