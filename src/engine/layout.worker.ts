// The engine's layout worker: FD 2D or FD 3D, posting frames as it settles,
// so NodeLink can draw the run live.

import { forceDirected2d, forceDirected3d } from "../pipeline/layouts";
import { harmonicVectors } from "../pipeline/seriations";
import type { LayoutMessage, LayoutRequest } from "./protocol";

// About ten frames a second at most, so the main thread isn't flooded on a
// small graph that runs its passes in a blink.
const FRAME_MS = 100;

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const { type, graph } = e.data;
  const harm = e.data.harm ?? harmonicVectors(graph);
  let last = performance.now();
  const run = type === "fd2d" ? forceDirected2d : forceDirected3d;
  const coords = run(graph, harm, (pass, passes, read) => {
    const now = performance.now();
    if (now - last < FRAME_MS) return;
    last = now;
    const frame = read();
    const msg: LayoutMessage = { type: "frame", coords: frame, pass, passes };
    self.postMessage(msg, { transfer: [frame.buffer] });
  });
  const msg: LayoutMessage = { type: "done", coords };
  self.postMessage(msg, { transfer: [coords.buffer] });
};
