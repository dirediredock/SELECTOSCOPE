import { describe, expect, it } from "vitest";
import { cores } from "./cores";
import { hopCensus } from "./hopcensus";
import { ingest } from "./ingest";

// A graph from "a-b b-c ..." with its values read back by node_id.
function load(spec: string) {
  const rows = spec.split(" ").map((p) => p.replace("-", ","));
  const { graph } = ingest({ edgelist: ["source,target", ...rows].join("\n") });
  const by = <T>(values: ArrayLike<T>) => Object.fromEntries(graph.nodeId.map((id, v) => [id, values[v]]));
  return { graph, by };
}

describe("cores", () => {
  it("peels a triangle with a tail into layers", () => {
    const { graph, by } = load("a-b b-c c-a c-d d-e");
    const { core, onion } = cores(graph);
    expect(by(core)).toEqual({ a: 2, b: 2, c: 2, d: 1, e: 1 });
    // e goes first; then d; then the triangle at core 2.
    expect(by(onion)).toEqual({ e: 1, d: 2, a: 3, b: 3, c: 3 });
  });
});

describe("hop census", () => {
  it("counts stubs per hop on a path", () => {
    const { graph, by } = load("a-b b-c c-d");
    const { ecc, stubs } = hopCensus(graph);
    expect(by(ecc)).toEqual({ a: 3, b: 2, c: 2, d: 3 });
    // Each node's row sums to m plus the edges inside layers (none on a path).
    let at = 0;
    const rows: Record<string, number[]> = {};
    for (let v = 0; v < graph.n; v++) {
      rows[graph.nodeId[v]] = [...stubs.subarray(at, at + ecc[v] + 1)];
      at += ecc[v] + 1;
    }
    expect(rows.a).toEqual([1, 1, 1, 0]);
    expect(rows.b).toEqual([2, 1, 0]);
  });

  it("counts an edge inside a layer twice", () => {
    const { graph } = load("a-b b-c c-a");
    const { ecc, stubs } = hopCensus(graph);
    expect([...ecc]).toEqual([1, 1, 1]);
    expect([...stubs.subarray(0, 2)]).toEqual([2, 2]);
  });
});
