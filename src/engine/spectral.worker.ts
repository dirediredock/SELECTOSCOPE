// The engine's spectral worker: the harmonics first, since FD starts from
// them, then the principal components.

import type { Graph } from "../pipeline/graph";
import { componentVectors, harmonicVectors, seriate } from "../pipeline/seriations";
import type { SpectralMessage } from "./protocol";

self.onmessage = (e: MessageEvent<{ graph: Graph }>) => {
  const { graph } = e.data;
  const harm = harmonicVectors(graph);
  const post = (msg: SpectralMessage) => self.postMessage(msg);
  post({ type: "harmonics", harm, orders: seriate(harm, []) });
  const comp = componentVectors(graph);
  post({ type: "components", orders: seriate([], comp) });
};
