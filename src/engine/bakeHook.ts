// The bake's way into the app (scripts/bake.ts): at `?bake` the page mounts
// no interface and offers one call instead, which builds a curated dataset
// from its CSVs with the engine, in its workers, as an upload is built, and
// returns the build as Export saves it.
// Why no interface: nothing on screen may add to a build (NodeLink asking
// for FD 3D, the opening showcase load).

import { datasetStore } from "../data/datasetStore";
import { exportable, stringify } from "../data/format";
import type { OpeningView } from "../data/graph";
import { bakeThumb } from "../panes/data/thumb";
import { FILE_NAMES } from "../pipeline/ingest";
import type { DatasetTexts, FileKind } from "../pipeline/ingest";
import { startBuild } from "./engine";

export interface Baked {
  json: string;
  thumb: string; // base64
}

// The files are named by the caller, which can see the folder: a missing
// file here would come back as the app's page, not a 404.
async function readTexts(name: string, files: FileKind[]): Promise<DatasetTexts> {
  const texts: Partial<Record<FileKind, string>> = {};
  for (const kind of files) {
    const res = await fetch(`datasets/${name}/${FILE_NAMES[kind]}`);
    if (!res.ok) throw new Error(`${name}/${FILE_NAMES[kind]}: HTTP ${res.status}`);
    texts[kind] = await res.text();
  }
  if (!texts.edgelist) throw new Error(`${name}: no edge list`);
  return texts as DatasetTexts;
}

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function bake(name: string, title: string, view: OpeningView, files: FileKind[]): Promise<Baked> {
  const texts = await readTexts(name, files);
  await new Promise<void>((resolve, reject) => {
    startBuild(texts, {
      name,
      title,
      view,
      onRefused: (reason) => reject(new Error(`${name}: refused: ${reason}`)),
      onEnd: (failure) => (failure ? reject(new Error(`${name}: ${failure}`)) : resolve()),
    });
  });
  const graph = datasetStore.get().graph;
  if (!graph || graph.name !== name || !exportable(graph)) throw new Error(`${name}: the build didn't finish`);
  return { json: stringify(graph), thumb: base64(bakeThumb(graph)) };
}

declare global {
  interface Window {
    selectoscopeBake?: typeof bake;
  }
}

window.selectoscopeBake = bake;
