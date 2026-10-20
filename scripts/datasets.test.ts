// The curated inputs (public/datasets/): every file parses with the expected
// header, and every layout gives every node in the edge list exactly one
// position.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTooltipLines } from "../src/tooltipLines";
import { column, parseCsv } from "../src/pipeline/csv";

const datasets = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "datasets");
const read = (name: string, file: string) => parseCsv(readFileSync(join(datasets, name, file), "utf8"));

const HEADERS: Record<string, string[]> = {
  "labels.csv": ["node_id", "label"],
  "layout_2d.csv": ["node_id", "x", "y"],
  "layout_3d.csv": ["node_id", "x", "y", "z"],
};

const manifest = parseCsv(readFileSync(join(datasets, "manifest.csv"), "utf8"));
const names = column(manifest, "name")!;

describe("curated datasets", () => {
  it("has a manifest with a folder per row", () => {
    expect(manifest.header).toEqual(["name", "title", "group", "view"]);
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) expect(existsSync(join(datasets, name, "edgelist.csv")), name).toBe(true);
  });

  // docs/tooltips_data.txt: one line per dataset, in manifest order under
  // its group's heading, each ending as every tooltip does.
  it("has a tooltip for every dataset, under its group", () => {
    const text = readFileSync(join(datasets, "..", "..", "docs", "tooltips_data.txt"), "utf8");
    const lines = parseTooltipLines(text, "docs/tooltips_data.txt");
    const groups = column(manifest, "group")!;
    expect(lines.map((l) => l.label)).toEqual(names);
    lines.forEach((l, i) => {
      expect(l.heading, l.label).toBe(groups[i].toUpperCase());
      expect(l.text.endsWith("."), l.label).toBe(true);
    });
  });

  it.each(names)("%s parses, and its layouts cover every node once", (name) => {
    const edges = read(name, "edgelist.csv");
    expect(edges.header).toEqual(["source", "target"]);
    const nodes = new Set([...column(edges, "source")!, ...column(edges, "target")!]);
    for (const [file, header] of Object.entries(HEADERS)) {
      if (!existsSync(join(datasets, name, file))) continue;
      const t = read(name, file);
      expect(t.header, file).toEqual(header);
      const ids = column(t, "node_id")!;
      expect(new Set(ids).size, `${file} repeats an id`).toBe(ids.length);
      for (const id of ids) expect(nodes.has(id), `${file}: ${id}`).toBe(true);
      if (file.startsWith("layout")) {
        expect(ids.length, `${file} misses nodes`).toBe(nodes.size);
        for (const r of t.rows) for (const v of r.slice(1)) expect(Number.isFinite(Number(v))).toBe(true);
      }
    }
  });
});
