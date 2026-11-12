import { datasetStore } from "../state/dataset";
import { setSounding } from "../state/sounding";
import { sweepAxisOf, sweepRunStore } from "../state/sweepRun";
import { sweepSettingsStore } from "../state/sweepSettings";
import { sweepSoundStore } from "../state/sweepSound";
import { play, sleep, wake } from "./synth";
import type { Graph } from "../data/graph";
import { entering, spread, tonesOf } from "./voices";

// The sweep, heard: at each step the pane's marks that come into the band
// sound once, pitched by their place across it (the pane's lowest mark on the
// lowest note, its highest on the highest), ringing longer the higher their
// degree, and show red in every pane for that step. After NASA's
// sonifications of Chandra images, where a scan line crosses the picture and
// height is pitch. Off unless the
// strip's sound button is on, so a silent sweep looks as it always did.

// The flash lasts one step, so it is the band's leading line; on a band that
// stops (a manual step), until its longest note ends.
let timer: ReturnType<typeof setTimeout> | undefined;

// Each node's degree spread over the length range, once per graph.
const lengthsByGraph = new WeakMap<Graph, Float64Array>();
function nodeLengths(g: Graph): Float64Array {
  let l = lengthsByGraph.get(g);
  if (!l) lengthsByGraph.set(g, (l = spread(g.degree)));
  return l;
}

function hush() {
  clearTimeout(timer);
  setSounding([], []);
}

sweepRunStore.subscribe((s, prev) => {
  // Starting, stopping or moving to another pane sounds nothing.
  if (s.slot === null || s.slot !== prev.slot) return hush();
  // The band moved: not a paused re-read, or a setting shown at the same step.
  if (s.step === prev.step) return;
  hush();
  if (!sweepSoundStore.get().on) return;
  const voice = sweepAxisOf(s.slot)?.voice;
  const graph = datasetStore.get().graph;
  if (!voice || !graph) return;
  const { area, wrap } = sweepSettingsStore.get();
  const ids = entering(voice, s.step, prev.step, area / 100, wrap);
  if (!ids.length) return;
  // Every step: the panes build their axis afresh at each read.
  const pitch = spread(voice.pitch);
  const node = nodeLengths(graph);
  // An edge rings for its two ends' mean.
  const length = voice.type === "node" ? (i: number) => node[i]! : (e: number) => (node[graph.edgeSource[e]!]! + node[graph.edgeTarget[e]!]!) / 2;
  const tones = tonesOf(
    ids.map((i) => pitch[i]!),
    ids.map(length),
  );
  play(tones);
  if (voice.type === "node") setSounding(ids, []);
  else setSounding(ids.flatMap((e) => [graph.edgeSource[e]!, graph.edgeTarget[e]!]), ids);
  timer = setTimeout(hush, 1000 * Math.max(...tones.map((t) => t.ring)));
});

sweepSoundStore.subscribe((s, prev) => {
  if (s.on === prev.on) return;
  if (s.on) wake();
  else {
    sleep();
    hush();
  }
});
