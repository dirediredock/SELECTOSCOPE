import { createStore } from "./createStore";
import { data } from "../data/dataStore";

// The node set (blue) and the edge set (orange) are independent. Each change
// replaces the set with a new one, so every snapshot stays valid: undo later
// is a stack of snapshots.

export type ItemType = "node" | "edge";
export type Mode = "replace" | "add" | "subtract";
// Where a shape writes (the Select mode), and what a sweep lights: one set,
// or both.
export type SelectTarget = ItemType | "both";

export interface SelectionState {
  nodes: ReadonlySet<number>;
  edges: ReadonlySet<number>;
}

const EMPTY: ReadonlySet<number> = new Set();
const KEY = { node: "nodes", edge: "edges" } as const;

export const selection = createStore<SelectionState>({ nodes: EMPTY, edges: EMPTY });

function put(type: ItemType, next: ReadonlySet<number>) {
  selection.set({ [KEY[type]]: next } as Partial<SelectionState>);
}

const setOf = (type: ItemType) => selection.get()[KEY[type]];

// A set after `ids` replace it, join it or leave it.
export function merged(cur: ReadonlySet<number>, mode: Mode, ids: Iterable<number>): ReadonlySet<number> {
  if (mode === "replace") return new Set(ids);
  const next = new Set(cur);
  for (const id of ids) {
    if (mode === "add") next.add(id);
    else next.delete(id);
  }
  return next;
}

export function applySelection(type: ItemType, mode: Mode, ids: Iterable<number>) {
  put(type, merged(setOf(type), mode, ids));
}

export function toggleItem(type: ItemType, id: number) {
  const next = new Set(setOf(type));
  if (!next.delete(id)) next.add(id);
  put(type, next);
}

// A group picked as one (a Cores pill): added unless all of it is already
// in the set, then removed.
export function toggleGroup(type: ItemType, ids: readonly number[]) {
  const next = new Set(setOf(type));
  const all = ids.every((id) => next.has(id));
  for (const id of ids) {
    if (all) next.delete(id);
    else next.add(id);
  }
  put(type, next);
}

// The edges whose two endpoints are both in `nodes`: the edges they share.
export function sharedEdges(source: Uint32Array, target: Uint32Array, nodes: ReadonlySet<number>): number[] {
  const out: number[] = [];
  for (let e = 0; e < source.length; e++) if (nodes.has(source[e]!) && nodes.has(target[e]!)) out.push(e);
  return out;
}

const sharedBy = (nodes: ReadonlySet<number>): ReadonlySet<number> => {
  const g = data.get().graph;
  return g ? new Set(sharedEdges(g.edgeSource, g.edgeTarget, nodes)) : EMPTY;
};

// Writes a shape's nodes and edges to the set(s) the target names, each
// replaced, joined or cut by `mode`. One set call, so one snapshot.
function write(target: SelectTarget, mode: Mode, nodes: ReadonlySet<number>, edges: () => ReadonlySet<number>) {
  const cur = selection.get();
  const next: Partial<SelectionState> = {};
  if (target !== "edge") next.nodes = merged(cur.nodes, mode, nodes);
  if (target !== "node") next.edges = merged(cur.edges, mode, edges());
  selection.set(next);
}

// A shape of nodes, written where the target says: the node set, the edges
// the nodes share, or both. The edges come from the shape alone and are
// computed once, here; later changes to the node set leave them alone.
export function selectFromNodes(target: SelectTarget, ids: Iterable<number>, mode: Mode = "replace") {
  const nodes = new Set(ids);
  write(target, mode, nodes, () => sharedBy(nodes));
}

// The nodes that `edges` touch: their endpoints.
export function endpointsOf(source: Uint32Array, target: Uint32Array, edges: Iterable<number>): Set<number> {
  const out = new Set<number>();
  for (const e of edges) {
    out.add(source[e]!);
    out.add(target[e]!);
  }
  return out;
}

// A shape of edges (the matrix), written where the target says: the edge set,
// the edges' endpoints, or both.
export function selectFromEdges(target: SelectTarget, ids: Iterable<number>, mode: Mode = "replace") {
  const edges = new Set(ids);
  const g = data.get().graph;
  const nodes = g ? endpointsOf(g.edgeSource, g.edgeTarget, edges) : EMPTY;
  write(target, mode, nodes, () => edges);
}

// ---------- Extend: grow or shrink the selection by one hop ----------

// The edges touching a seed (the edges one hop walks) and their endpoints,
// the seeds included.
export function hopOut(
  source: Uint32Array,
  target: Uint32Array,
  seeds: ReadonlySet<number>,
): { nodes: Set<number>; edges: number[] } {
  const nodes = new Set(seeds);
  const edges: number[] = [];
  for (let e = 0; e < source.length; e++) {
    const s = source[e]!;
    const t = target[e]!;
    if (seeds.has(s) || seeds.has(t)) {
      edges.push(e);
      nodes.add(s);
      nodes.add(t);
    }
  }
  return { nodes, edges };
}

// A hop starts from everything selected: the node set and the edge set's
// endpoints. Its result goes where the Select mode says, as a shape's does.
function hopPlan(s: SelectionState) {
  const g = data.get().graph;
  if (!g) return null;
  const region = endpointsOf(g.edgeSource, g.edgeTarget, s.edges);
  for (const v of s.nodes) region.add(v);
  return hopOut(g.edgeSource, g.edgeTarget, region);
}

// A Grow changes a set when it brings something new.
export function canGrow(s: SelectionState, target: SelectTarget): boolean {
  const plan = hopPlan(s);
  if (!plan) return false;
  const adds = (cur: ReadonlySet<number>, ids: Iterable<number>) => {
    for (const id of ids) if (!cur.has(id)) return true;
    return false;
  };
  return (target !== "edge" && adds(s.nodes, plan.nodes)) || (target !== "node" && adds(s.edges, plan.edges));
}

// Shrink only steps back Grows. Each Grow remembers the sets before and after
// it, so Shrink returns to them exactly, whatever the mode is now, and stops
// at the origin, the sets the first Grow started from: it never eats into what
// the user picked. The chain holds only while the sets are still where it
// left them: any other change (a shape, a click, a set's Clear, a new dataset) makes
// the sets a new starting selection, and the chain is forgotten.
interface GrowStep {
  before: SelectionState;
  after: SelectionState;
}
let grown: GrowStep[] = [];
let origin: SelectionState | null = null;

const sameSets = (a: SelectionState, b: SelectionState) => a.nodes === b.nodes && a.edges === b.edges;

// Where the chain left the sets: after its last Grow, or back at its origin.
const chainEnd = () => grown.at(-1)?.after ?? origin;

function forgetChain() {
  grown = [];
  origin = null;
}

function inChain(s: SelectionState): boolean {
  const end = chainEnd();
  if (end && sameSets(end, s)) return true;
  forgetChain();
  return false;
}

export function canShrink(s: SelectionState): boolean {
  const end = chainEnd();
  return !!end && sameSets(end, s) && grown.length > 0;
}

// How many Grows the sets stand from their origin: 0 on sets no Grow made.
export function hopCount(s: SelectionState): number {
  return canShrink(s) ? grown.length : 0;
}

export function growSelection(target: SelectTarget) {
  const before = selection.get();
  const plan = hopPlan(before);
  if (!plan) return;
  if (!inChain(before)) origin = before;
  write(target, "add", plan.nodes, () => new Set(plan.edges));
  grown.push({ before, after: selection.get() });
}

// Steps back the last Grow; at the origin, or on sets no Grow made, it does
// nothing.
export function shrinkSelection() {
  if (!inChain(selection.get())) return;
  const step = grown.pop();
  if (step) selection.set({ nodes: step.before.nodes, edges: step.before.edges });
}

export function clearSet(type: ItemType) {
  if (setOf(type).size) put(type, EMPTY);
}

// ---------- Hover: one item, shown red in every pane ----------

// `group` is set when the item stands for several nodes at once (a Cores
// pill): then all of them are hovered, and `id` is one of them.
export interface HoverItem {
  type: ItemType;
  id: number;
  group?: readonly number[];
}

export const hover = createStore<{ item: HoverItem | null }>({ item: null });

// The hovered nodes: the group, the one node, or none for an edge.
export const hoveredNodes = (item: HoverItem | null): readonly number[] =>
  item?.type === "node" ? (item.group ?? [item.id]) : [];

export function setHover(type: ItemType, id: number | null, group?: readonly number[]) {
  const cur = hover.get().item;
  if (id === null) {
    if (cur) hover.set({ item: null });
  } else if (!cur || cur.type !== type || cur.id !== id || cur.group !== group) {
    hover.set({ item: group ? { type, id, group } : { type, id } });
  }
}

export function clearHover() {
  if (hover.get().item) hover.set({ item: null });
}

// A new dataset starts with nothing selected.
data.subscribe((s, prev) => {
  if (s.graph !== prev.graph) {
    forgetChain();
    selection.set({ nodes: EMPTY, edges: EMPTY });
    clearHover();
  }
});

// A set's share of the graph, as a fill: "<1%" for a sliver, so a set that
// holds anything never reads 0%.
export function sharePercent(count: number, total: number | null): string {
  if (!total || count === 0) return "0%";
  const p = (100 * count) / total;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}
