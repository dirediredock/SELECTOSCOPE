import { describe, expect, it } from "vitest";
import { cores } from "./cores";
import { ingest } from "./ingest";
import { ksnakes } from "./ksnakes";

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
});
