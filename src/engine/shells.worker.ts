// The engine's Shells worker: cores and onion from one peeling, then the
// Shells pane's orderings.

import type { Graph } from "../pipeline/graph";
import { cores } from "../pipeline/cores";
import { ksnakes } from "../pipeline/ksnakes";
import type { ShellsMessage } from "./protocol";

self.onmessage = (e: MessageEvent<{ graph: Graph }>) => {
  const { graph } = e.data;
  const c = cores(graph);
  self.postMessage({ type: "shells", cores: c, ksnakes: ksnakes(graph, c) } satisfies ShellsMessage);
};
