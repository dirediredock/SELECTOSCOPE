// k-core numbers and onion layers, by node_idx.
//
// Onion layers are k-core peeling recorded round by round: each round removes
// every node whose degree is at most the current core value, and each round
// is one layer, numbered from 1. The core value only rises, to the smallest
// degree left when every node exceeds it. A node's core number is the core
// value of the round that removes it. Who goes in a round is fixed before
// any is removed, so no order within the graph can change the layers.

import type { Graph } from "./graph";
import { degrees } from "./graph";

export interface Cores {
  core: Uint32Array;
  onion: Uint32Array;
}

export function cores(g: Graph): Cores {
  const { n, offsets, neighbours } = g;
  const deg = degrees(g);
  const core = new Uint32Array(n);
  const onion = new Uint32Array(n);
  const removed = new Uint8Array(n);
  let alive = Array.from({ length: n }, (_, v) => v);
  let current = 1;
  let layer = 1;
  while (alive.length) {
    let low = Infinity;
    for (const v of alive) if (deg[v] < low) low = deg[v];
    if (low > current) current = low;
    const round = alive.filter((v) => deg[v] <= current);
    for (const v of round) {
      onion[v] = layer;
      core[v] = current;
      removed[v] = 1;
    }
    for (const v of round) {
      for (let i = offsets[v]; i < offsets[v + 1]; i++) {
        const w = neighbours[i];
        if (!removed[w]) deg[w]--;
      }
    }
    alive = alive.filter((v) => !removed[v]);
    layer++;
  }
  return { core, onion };
}
