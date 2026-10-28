// The committed builds: one for every curated dataset, and each read back
// writes out unchanged. Re-baking them in the app is bake.chrome.test.ts
// (`npm run test:builds`), which needs Chrome.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fromJson, stringify } from "../src/data/format";
import { BUILDS, manifest } from "./bake";

const rows = manifest();

describe("builds", () => {
  it("lists every curated dataset", () => {
    const index = JSON.parse(readFileSync(join(BUILDS, "index.json"), "utf8"));
    expect(index.datasets.map((d: { name: string }) => d.name)).toEqual(rows.map((r) => r.name));
    for (const r of rows) expect(existsSync(join(BUILDS, `${r.name}.json`)), r.name).toBe(true);
  });

  it.each(rows.map((r) => r.name))("reads %s back and writes it out unchanged", (name) => {
    const text = readFileSync(join(BUILDS, `${name}.json`), "utf8");
    expect(stringify(fromJson(JSON.parse(text))) === text).toBe(true);
  });

  // Exports made before these keys were retired must still open.
  it("reads an older build's retired keys and writes it out without them", () => {
    const text = readFileSync(join(BUILDS, "karate_club.json"), "utf8");
    const old = JSON.parse(text);
    old.meta.seed = 1736;
    old.meta.has_labels = !!old.nodes.label;
    old.meta.report = { rows: 78, self_loops: 0, repeated: 0, components: 1, dropped_nodes: 0, dropped_edges: 0 };
    old.centrality = { eigenvector: old.nodes.node_id.map(() => 0.1) };
    for (const mode of Object.values(old.ksnakes.orders) as { crossings?: object }[]) mode.crossings = { packed: 0, topdown: 0 };
    expect(stringify(fromJson(old)) === text).toBe(true);
  });
});
