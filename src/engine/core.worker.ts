// The engine's first worker: ingest, then the stages that read the whole
// graph at once: cores, onion and the Shells pane's orderings, then
// centrality. Each result is posted the moment it lands, so the panes
// draw as the build goes.

import { eigenvectorCentrality } from "../pipeline/centrality";
import { cores } from "../pipeline/cores";
import { ksnakes } from "../pipeline/ksnakes";
import { IngestError, ingest } from "../pipeline/ingest";
import type { Ingested } from "../pipeline/ingest";
import type { CoreMessage, CoreRequest } from "./protocol";

const post = (msg: CoreMessage, transfer: Transferable[] = []) => self.postMessage(msg, { transfer });

// A file that can't be read is refused with a message. A crash past ingest
// reaches the engine's onerror, which fails the stage it was on.
self.onmessage = (e: MessageEvent<CoreRequest>) => {
  let ingested: Ingested;
  try {
    ingested = ingest(e.data.texts);
  } catch (err) {
    post({ type: "error", message: err instanceof IngestError ? err.message : String(err) });
    return;
  }
  const { graph, labels, layouts, report, refused, warnings } = ingested;
  post({ type: "ingested", graph, labels, layouts, report, refused, warnings });
  const c = cores(graph);
  post({ type: "cores", cores: c, ksnakes: ksnakes(graph, c) });
  const centrality = eigenvectorCentrality(graph);
  post({ type: "centrality", centrality }, [centrality.buffer]);
};
