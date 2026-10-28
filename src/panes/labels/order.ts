import type { LabelSort } from "../../state/labels";

// The Labels pane's pure logic: row order, Finder clicks and the rubber band.
// No DOM here, so it is unit-tested directly (order.test.ts).

// What each sort reads, by node_id.
export interface SortKeys {
  labels: readonly string[];
  degree: ArrayLike<number>;
  onion: ArrayLike<number>;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// Every node_id in the sort's order. Last ties fall to node_id, which is the
// randomized id, so no sort leaks the source file's order. Labels (A–Z) puts
// empty labels last, so an unlabelled dataset keeps the random order. Onion
// puts the deepest first, then the largest degree.
export function sortRank(sort: LabelSort, keys: SortKeys): Uint32Array {
  const { labels, degree } = keys;
  const byDegree = (a: number, b: number) => degree[b]! - degree[a]!;
  const by = (k: ArrayLike<number>) => (a: number, b: number) => k[b]! - k[a]! || byDegree(a, b);
  const compare: Record<LabelSort, (a: number, b: number) => number> = {
    alpha: (a, b) => Number(!labels[a]) - Number(!labels[b]) || collator.compare(labels[a]!, labels[b]!),
    degree: byDegree,
    onion: by(keys.onion),
  };
  const ids = Array.from({ length: labels.length }, (_, i) => i);
  ids.sort((a, b) => compare[sort](a, b) || a - b);
  return Uint32Array.from(ids);
}

// The text of each row's value column under `sort`, or null under Labels (A–Z),
// which shows none. Integers pad to the graph's widest so the column reads
// evenly: each row is its own grid, so the pad is a figure space (a digit's
// width) rather than CSS alignment.
export function sortValue(sort: LabelSort, keys: SortKeys): ((id: number) => string) | null {
  if (sort === "alpha") return null;
  const k = keys[sort];
  let max = 0;
  for (let i = 0; i < k.length; i++) max = Math.max(max, k[i]!);
  const width = String(max).length;
  return (id) => String(k[id]!).padStart(width, "\u2007");
}

// Selected rows first, then the rest, each group in `rank` order.
export function labelOrder(rank: Uint32Array, selected: ReadonlySet<number>): Uint32Array {
  const out = new Uint32Array(rank.length);
  let k = 0;
  for (const id of rank) if (selected.has(id)) out[k++] = id;
  for (const id of rank) if (!selected.has(id)) out[k++] = id;
  return out;
}

export function sameOrder(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Rows sit at content y = top + i * pitch. A point in the gap below a row
// belongs to that row, so hover never flickers off between rows.
export function rowAt(y: number, pitch: number, top: number, count: number): number | null {
  const i = Math.floor((y - top) / pitch);
  return i >= 0 && i < count ? i : null;
}

// The rows a band from content y `ya` to `yb` touches, as [first, last], or
// null when it lies wholly in the padding above the first row or below the last.
export function bandRows(ya: number, yb: number, pitch: number, top: number, count: number): [number, number] | null {
  const first = Math.max(0, Math.floor((Math.min(ya, yb) - top) / pitch));
  const last = Math.min(count - 1, Math.floor((Math.max(ya, yb) - top) / pitch));
  return first <= last ? [first, last] : null;
}
