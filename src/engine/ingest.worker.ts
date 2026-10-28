// The engine's first worker: reads and cleans the dataset's files, posts the
// graph, and exits. Every other stage starts from what it posts.

import { IngestError, ingest } from "../pipeline/ingest";
import type { IngestMessage, IngestRequest } from "./protocol";

const post = (msg: IngestMessage) => self.postMessage(msg);

// A file that can't be read is refused with a message.
self.onmessage = (e: MessageEvent<IngestRequest>) => {
  try {
    const { graph, labels, layouts, report, refused, warnings } = ingest(e.data.texts);
    post({ type: "ingested", graph, labels, layouts, report, refused, warnings });
  } catch (err) {
    post({ type: "error", message: err instanceof IngestError ? err.message : String(err) });
  }
  self.close();
};
