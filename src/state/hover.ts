import { createStore } from "./createStore";
import type { ItemType } from "./selection";

// Hover: one item, shown red in every pane.

// `group` is set when the item stands for several nodes at once (a Shells
// pill): then all of them are hovered, and `id` is one of them.
export interface HoverItem {
  type: ItemType;
  id: number;
  group?: readonly number[];
}

export const hoverStore = createStore<{ item: HoverItem | null }>({ item: null });

// The hovered nodes: the group, the one node, or none for an edge.
export const hoveredNodes = (item: HoverItem | null): readonly number[] =>
  item?.type === "node" ? (item.group ?? [item.id]) : [];

export function setHover(type: ItemType, id: number | null, group?: readonly number[]) {
  const cur = hoverStore.get().item;
  if (id === null) {
    if (cur) hoverStore.set({ item: null });
  } else if (!cur || cur.type !== type || cur.id !== id || cur.group !== group) {
    hoverStore.set({ item: group ? { type, id, group } : { type, id } });
  }
}

export function clearHover() {
  if (hoverStore.get().item) hoverStore.set({ item: null });
}
