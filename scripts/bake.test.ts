// The committed builds are the pipeline's snapshots: re-baking a curated
// dataset gives the very same bytes, so any change to a result shows here as
// a build to re-bake and review; and a build read back writes out unchanged.
// `npm test` re-bakes a sample; `npm run test:builds` (BAKE_ALL) every one,
// which takes minutes.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fromJson, stringify } from "../src/data/format";
import { BUILDS, bake, manifest } from "./bake";

const rows = manifest();
const SAMPLE = ["karate_club", "les_miserables_multidensity", "london_transport", "indo_european", "power"];
const names = process.env.BAKE_ALL ? rows.map((r) => r.name) : SAMPLE;

describe("builds", () => {
  it("lists every curated dataset", () => {
    const index = JSON.parse(readFileSync(join(BUILDS, "index.json"), "utf8"));
    expect(index.datasets.map((d: { name: string }) => d.name)).toEqual(rows.map((r) => r.name));
    for (const r of rows) expect(existsSync(join(BUILDS, `${r.name}.json`)), r.name).toBe(true);
  });

  it.each(names)("re-bakes %s to the same bytes", (name) => {
    const row = rows.find((r) => r.name === name)!;
    const { json, thumb } = bake(row);
    expect(json === readFileSync(join(BUILDS, `${name}.json`), "utf8")).toBe(true);
    expect(Buffer.from(thumb).equals(readFileSync(join(BUILDS, "thumbs", `${name}.bin`)))).toBe(true);
  }, 120_000);

  it.each(names)("reads %s back and writes it out unchanged", (name) => {
    const text = readFileSync(join(BUILDS, `${name}.json`), "utf8");
    expect(stringify(fromJson(JSON.parse(text))) === text).toBe(true);
  });
});
