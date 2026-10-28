// The committed builds are the engine's snapshots: re-baking a curated dataset
// in the app gives the very same bytes, so any change to a result shows here
// as a build to re-bake and review. A sample, since each is a real build in
// headless Chrome; `npm run bake` and its git diff cover every one.
// Runs only under `npm run test:builds` (BAKE_CHROME), which needs Chrome.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUILDS, manifest, openBaker } from "./bake";
import type { Baker } from "./bake";

const SAMPLE = ["karate_club", "les_miserables_multidensity", "london_transport", "indo_european", "human_connectome", "power"];
const rows = manifest().filter((r) => SAMPLE.includes(r.name));

describe.runIf(process.env.BAKE_CHROME)("builds baked in the app", () => {
  let baker: Baker;
  beforeAll(async () => {
    baker = await openBaker();
  }, 180_000);
  afterAll(() => baker?.close());

  it.each(rows)("re-bakes $name to the same bytes", async (row) => {
    const { json, thumb } = await baker.bake(row);
    expect(json === readFileSync(join(BUILDS, `${row.name}.json`), "utf8")).toBe(true);
    expect(Buffer.from(thumb).equals(readFileSync(join(BUILDS, "thumbs", `${row.name}.bin`)))).toBe(true);
  }, 180_000);
});
