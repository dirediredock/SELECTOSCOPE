import { createStore } from "./createStore";
import { LAYOUTS } from "../controlOptions";
import { fitView } from "./paneViews";
import { paneRowStore, retyped } from "./paneRow";
import type { SlotId } from "./paneRow";
import { datasetStore } from "../data/datasetStore";
import type { Graph } from "../data/graph";
import { identity, rotateBy, startRotation } from "../panes/nodelink/rotation";
import type { Mat3 } from "../panes/nodelink/rotation";

// NodeLink's view settings, chosen in the bottom strip while it is focused.
// Each NodeLink slot has its own.

export type NodeLinkLayout = (typeof LAYOUTS)[number]["id"];

// What the pane draws: a layout (turned, for 3D and Bespoke 3D), or the live
// simulation.
export type NodeLinkView = NodeLinkLayout | "live";

// The live simulation must tick and draw inside a frame. Beyond these sizes
// it can't, so the Interactive view is off for the dataset.
export const LIVE_MAX_NODES = 6000;
export const LIVE_MAX_EDGES = 20000;
export const liveAllowed = (g: Graph | null) => !!g && g.n <= LIVE_MAX_NODES && g.m <= LIVE_MAX_EDGES;

// Each layout goes to its slot by origin. 2D (FD) and 3D (FD in 3D) are
// computed from the edges alone; Bespoke 2D and Bespoke 3D are the dataset's
// own, from its source or another method (a 2D derived from its own 3D counts
// as its own). The data holds one 3D, its own or FD in 3D, so a dataset has 3D
// or Bespoke 3D, never both.
export function layoutPositions(g: Graph, id: NodeLinkLayout): Float32Array | null {
  switch (id) {
    case "fd":
      return g.layoutFd;
    case "fd3d":
      return g.layoutFd3d;
    case "own2d":
      return g.layoutOwn2d;
    case "own3d":
      return g.layoutOwn3d;
  }
}

export const hasLayout = (g: Graph | null, id: NodeLinkLayout) => !!g && layoutPositions(g, id) !== null;

// The layout picked is missing from the dataset, so the pane shows a message
// in place of the drawing. Interactive never shows one: it starts only from a layout.
export const layoutMissing = (g: Graph | null, s: Pick<NodeLinkSettings, "layout" | "live">) =>
  !!g && !s.live && !hasLayout(g, s.layout);

// 3D and Bespoke 3D are turned in space; the others are drawn flat.
export const isSpatial = (id: NodeLinkView) => id === "fd3d" || id === "own3d";

export interface NodeLinkSettings {
  layout: NodeLinkLayout; // the last layout picked; Interactive starts from it
  live: boolean; // the simulation shows in its place
  rotation: Mat3; // the 3D view's orientation
  liveRun: number; // bumped to restart the live simulation
}

export const shownView = (s: Pick<NodeLinkSettings, "layout" | "live">): NodeLinkView =>
  s.live ? "live" : s.layout;

// What a slot opens with: the dataset's own layout the manifest names (Bespoke
// 3D for a native shape, Bespoke 2D for a map) with Interactive off; else 2D
// with Interactive on, or past the Interactive limit its own 3D, or 2D, with
// Interactive off; and the opening orientation for 3D.
let opening: NodeLinkSettings = {
  layout: "fd",
  live: true,
  rotation: identity(),
  liveRun: 0,
};
export function openingSettings(g: Graph | null): Pick<NodeLinkSettings, "layout" | "live"> {
  const named = g?.view;
  const own = named === "2d" ? "own2d" : named === "3d" ? "own3d" : null;
  if (own && hasLayout(g, own)) return { layout: own, live: false };
  if (liveAllowed(g)) return { layout: "fd", live: true };
  // FD 3D comes last in a build, so a large graph opens on its own 3D, or
  // else on FD 2D, rather than waiting for it.
  return { layout: hasLayout(g, "own3d") ? "own3d" : "fd", live: false };
}

type BySlot = Partial<Record<SlotId, NodeLinkSettings>>;

export const nodelinkStore = createStore<{ bySlot: BySlot }>({ bySlot: {} });

export const nodelinkIn = (s: { bySlot: BySlot }, slot: SlotId) => s.bySlot[slot] ?? opening;
export const nodelinkOf = (slot: SlotId) => nodelinkIn(nodelinkStore.get(), slot);

function update(slot: SlotId, patch: (s: NodeLinkSettings) => Partial<NodeLinkSettings>) {
  nodelinkStore.set((s) => {
    const cur = nodelinkIn(s, slot);
    return { bySlot: { ...s.bySlot, [slot]: { ...cur, ...patch(cur) } } };
  });
}

// Each view has its own extent, so a new layout refits the zoom. The 3D
// orientation is kept for coming back. While Interactive shows, the layout waits.
// Every layout can be picked: one the dataset lacks shows a message.
export function setNodeLinkLayout(slot: SlotId, layout: NodeLinkLayout) {
  const cur = nodelinkOf(slot);
  if (cur.live || layout === cur.layout) return;
  update(slot, () => ({ layout }));
  fitView(slot);
}

// Each switch on starts a fresh run from the layout shown; off returns to it.
// With no layout shown there is nothing to start from.
export function setNodeLinkLive(slot: SlotId, live: boolean) {
  const cur = nodelinkOf(slot);
  const g = datasetStore.get().graph;
  if (live === cur.live || (live && !(liveAllowed(g) && hasLayout(g, cur.layout)))) return;
  update(slot, (s) => ({ live, liveRun: live ? s.liveRun + 1 : s.liveRun }));
  fitView(slot);
}

export function rotateView(slot: SlotId, dx: number, dy: number) {
  update(slot, (s) => ({ rotation: rotateBy(s.rotation, dx, dy) }));
}

// A new dataset opens as openingSettings says, with 3D at its starting
// orientation.
datasetStore.subscribe((s, prev) => {
  if (s.graph === prev.graph || !s.graph) return;
  const rotation = startRotation(s.graph.layoutOwn3d ?? s.graph.layoutFd3d, s.graph.n);
  const open = openingSettings(s.graph);
  opening = { ...opening, ...open, rotation };
  const bySlot: BySlot = {};
  for (const [slot, cur] of Object.entries(nodelinkStore.get().bySlot)) {
    if (cur) bySlot[slot] = { ...cur, ...open, rotation };
  }
  nodelinkStore.set({ bySlot });
});

// A slot that becomes NodeLink starts from the opening settings.
paneRowStore.subscribe((s, prev) => {
  const fresh = retyped(s.slots, prev.slots);
  if (!fresh.some((slot) => nodelinkStore.get().bySlot[slot])) return;
  const bySlot = { ...nodelinkStore.get().bySlot };
  fresh.forEach((slot) => delete bySlot[slot]);
  nodelinkStore.set({ bySlot });
});
