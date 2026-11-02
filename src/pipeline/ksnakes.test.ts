import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cores } from "./cores";
import { ingest } from "./ingest";
import { ksnakes, structuralKinds } from "./ksnakes";

describe("Shells orderings", () => {
  it("keeps each bin contiguous, onion descending, in every ordering and mode", () => {
    // A triangle with a tail and two leaves on it.
    const { graph } = ingest({ edgelist: "source,target\na,b\nb,c\nc,a\nc,d\nd,e\nd,f\nb,g\n" });
    const c = cores(graph);
    const ks = ksnakes(graph, c);
    for (const mode of ["separate", "aggregate"] as const) {
      for (const o of ["packed", "topdown"] as const) {
        const row = ks.orders[mode].row[o];
        // Positions within a shell are 0..size-1, each once.
        const byShell = new Map<number, number[]>();
        for (let v = 0; v < graph.n; v++) byShell.set(c.core[v], [...(byShell.get(c.core[v]) ?? []), row[v]]);
        for (const pos of byShell.values()) expect(pos.sort((a, b) => a - b)).toEqual([...pos.keys()]);
      }
    }
    // The triangle is one island; the rest are islands of their own shell.
    const tri = ["a", "b", "c"].map((id) => ks.island[graph.nodeId.indexOf(id)]);
    expect(new Set(tri).size).toBe(1);
  });

  it("gives every node the same slot under relabelling, up to its kind", () => {
    const text = readFileSync("public/datasets/les_miserables/edgelist.csv", "utf8");
    const rows = text.trim().split("\n").slice(1).map((r) => r.split(",").slice(0, 2).map((x) => x.trim()));
    const ids = [...new Set(rows.flat())].sort();
    const fresh = new Map(ids.map((id, i) => [id, `n${(i * 31) % ids.length}`.padStart(5, "0")]));
    const back = new Map([...fresh].map(([a, b]) => [b, a]));
    const moved = rows.reverse().map(([a, b]) => `${fresh.get(b)},${fresh.get(a)}`);
    const a = ingest({ edgelist: text }).graph;
    const b = ingest({ edgelist: `source,target\n${moved.join("\n")}\n` }).graph;
    const ca = cores(a);
    const ka = ksnakes(a, ca);
    const kb = ksnakes(b, cores(b));
    const kinds = structuralKinds(a);
    const toA = new Map(a.nodeId.map((id, v) => [id, v]));
    for (const mode of ["separate", "aggregate"] as const) {
      for (const o of ["packed", "topdown"] as const) {
        const slot = new Map<string, number>();
        const key = (v: number, row: Uint32Array) => `${ca.core[v]}|${row[v]}`;
        for (let v = 0; v < a.n; v++) slot.set(key(v, ka.orders[mode].row[o]), v);
        for (let v = 0; v < b.n; v++) {
          const same = toA.get(back.get(b.nodeId[v])!)!;
          const there = slot.get(`${ca.core[same]}|${kb.orders[mode].row[o][v]}`)!;
          expect(kinds[there]).toBe(kinds[same]);
        }
      }
    }
  });
});
