// Builds every curated dataset (or the ones named) with the same pipeline the
// browser runs, and writes the builds the app loads out of the box:
//   npm run bake [name ...]
// public/builds/<name>.json per dataset, its thumbnail in
// public/builds/thumbs/<name>.bin, and public/builds/index.json listing them
// in manifest order. Deterministic: re-baking unchanged inputs changes
// no bytes (scripts/bake.test.ts).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildNow } from "../src/data/assemble";
import { stringify } from "../src/data/format";
import { bakeThumb } from "../src/panes/dataset/thumb";
import type { OpeningView } from "../src/data/graph";
import { column, parseCsv } from "../src/pipeline/csv";
import { readFileSync } from "node:fs";
import { DATASETS, readDataset } from "./datasetFiles";

export const BUILDS = join(DATASETS, "..", "builds");

export interface ManifestRow {
  name: string;
  title: string;
  group: string;
  view: OpeningView;
  // The Data pane row's tooltip (a licence, an acknowledgement); empty for none.
  note: string;
}

export function manifest(): ManifestRow[] {
  const t = parseCsv(readFileSync(join(DATASETS, "manifest.csv"), "utf8"));
  const [name, title, group, view, note] = ["name", "title", "group", "view", "note"].map((c) => column(t, c)!);
  return name.map((n, i) => ({ name: n, title: title[i], group: group[i], view: (view[i] || null) as OpeningView, note: note[i] }));
}

// The build, and its Data pane thumbnail.
export function bake(row: ManifestRow): { json: string; thumb: Uint8Array } {
  const g = buildNow(readDataset(row.name), row.name, row.title, row.view);
  return { json: stringify(g), thumb: bakeThumb(g) };
}

const isMain = process.argv[1]?.endsWith("bake.ts");
if (isMain) {
  const rows = manifest();
  const only = process.argv.slice(2);
  mkdirSync(join(BUILDS, "thumbs"), { recursive: true });
  for (const row of rows) {
    if (only.length && !only.includes(row.name)) continue;
    const t0 = performance.now();
    const { json, thumb } = bake(row);
    writeFileSync(join(BUILDS, `${row.name}.json`), json);
    writeFileSync(join(BUILDS, "thumbs", `${row.name}.bin`), thumb);
    console.log(`${row.name}: ${(json.length / 1e6).toFixed(2)} MB, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  const index = rows.map((r) => {
    const meta = JSON.parse(readFileSync(join(BUILDS, `${r.name}.json`), "utf8")).meta;
    const entry = { name: r.name, title: r.title, group: r.group, view: r.view, nodes: meta.nodes, edges: meta.edges, has_labels: meta.has_labels };
    return r.note ? { ...entry, note: r.note } : entry;
  });
  writeFileSync(join(BUILDS, "index.json"), JSON.stringify({ datasets: index }));
}
