// One of the engine's census workers: it takes the graph once, then chunks
// of sources, and posts each chunk's rows as soon as they're counted.

import type { Graph } from "../pipeline/graph";
import { concatCensus, hopCensusRange } from "../pipeline/hopcensus";
import type { HopsMessage, HopsRequest } from "./protocol";

let graph: Graph | null = null;

self.onmessage = (e: MessageEvent<HopsRequest>) => {
  const msg = e.data;
  if (msg.type === "graph") {
    graph = msg.graph;
    return;
  }
  const { ecc, rows } = hopCensusRange(graph!, msg.from, msg.to);
  const { stubs } = concatCensus(ecc, rows);
  const out: HopsMessage = { type: "rows", from: msg.from, ecc, stubs };
  self.postMessage(out, { transfer: [ecc.buffer, stubs.buffer] });
};
