import { describe, expect, it } from "vitest";
import { IngestError, ingest } from "./ingest";
import { permutation, rng } from "./randomize";

const edgelist = (rows: string[]) => ["source,target", ...rows].join("\n");

describe("randomize", () => {
  it("draws the same permutation from the same seed", () => {
    expect(permutation(rng(0), 50)).toEqual(permutation(rng(0), 50));
    expect(permutation(rng(0), 50)).not.toEqual(permutation(rng(1), 50));
    expect([...permutation(rng(0), 50)].sort((a, b) => a - b)).toEqual([...Array(50).keys()]);
  });
});

describe("ingest", () => {
  it("cleans loops, repeats and small components, and reports them", () => {
    const { graph, report } = ingest({
      edgelist: edgelist(["a,b", "b,a", "b,c", "c,c", "a,b", "x,y"]),
    });
    expect(graph.n).toBe(3);
    expect(graph.m).toBe(2);
    expect(report).toEqual({
      rows: 6,
      selfLoops: 1,
      repeated: 2,
      components: 2,
      droppedNodes: 2,
      droppedEdges: 1,
    });
    expect(new Set(graph.nodeId)).toEqual(new Set(["a", "b", "c"]));
    // Each edge keeps its row in the file.
    expect(new Set(graph.edgeRow)).toEqual(new Set([0, 2]));
  });

  it("orients every edge by node_idx and builds sorted adjacency", () => {
    const { graph } = ingest({ edgelist: edgelist(["1,2", "2,3", "3,1", "3,4"]) });
    for (let e = 0; e < graph.m; e++) expect(graph.source[e]).toBeLessThan(graph.target[e]);
    for (let v = 0; v < graph.n; v++) {
      const nb = [...graph.neighbours.subarray(graph.offsets[v], graph.offsets[v + 1])];
      expect(nb).toEqual([...nb].sort((a, b) => a - b));
    }
  });

  it("is deterministic", () => {
    const text = edgelist(["1,2", "2,3", "3,4", "4,5", "5,1", "1,3"]);
    const a = ingest({ edgelist: text }).graph;
    const b = ingest({ edgelist: text }).graph;
    expect(a.nodeId).toEqual(b.nodeId);
    expect(a.source).toEqual(b.source);
  });

  it("refuses a missing column, and ignores extra ones", () => {
    expect(ingest({ edgelist: "edge_id,source,target\n1,a,b\n1,b,c\n" }).graph.m).toBe(2);
    expect(() => ingest({ edgelist: "from,to\na,b\n" })).toThrow(IngestError);
    expect(() => ingest({ edgelist: "source,target\na,a\n" })).toThrow(IngestError);
  });

  it("joins optional files on node_id, skipping nodes the cleaning dropped", () => {
    const { graph, labels, layouts, refused } = ingest({
      edgelist: edgelist(["a,b", "b,c", "x,y"]),
      labels: 'node_id,label\na,"A, first"\nb,B\nc,\nx,dropped\n',
      layout2d: "node_id,x,y\na,0,0\nb,1,0\nc,1,1\n",
    });
    expect(refused).toEqual([]);
    const at = (id: string) => graph.nodeId.indexOf(id);
    expect(labels![at("a")]).toBe("A, first");
    expect(labels![at("c")]).toBe("");
    expect([...layouts.bespoke2d!.subarray(2 * at("c"), 2 * at("c") + 2)]).toEqual([1, 1]);
  });

  it("refuses an optional file whose ids don't match, keeping the rest", () => {
    const { labels, layouts, refused } = ingest({
      edgelist: edgelist(["a,b", "b,c"]),
      labels: "node_id,label\na,A\nq,Q\na,again\n",
      layout3d: "node_id,x,y,z\na,0,0,0\nb,1,0,0\n",
      layout2d: "node_id,x,y\na,0,0\nb,1,0\nc,one,1\n",
    });
    expect(labels).toBeNull();
    expect(layouts).toEqual({});
    expect(refused).toEqual([
      { kind: "labels", reason: "1 node_id not in the edge list, 1 repeated node_id" },
      { kind: "layout2d", reason: "1 coordinate not a number" },
      { kind: "layout3d", reason: "1 node with no row" },
    ]);
  });

  it("takes labels for only some nodes, with a warning", () => {
    const { graph, labels, refused, warnings } = ingest({
      edgelist: edgelist(["a,b", "b,c", "c,d"]),
      labels: "node_id,label\na,A\nc,C\n",
    });
    expect(refused).toEqual([]);
    expect(warnings).toEqual([{ kind: "labels", reason: "2 nodes with no label" }]);
    expect(labels![graph.nodeId.indexOf("a")]).toBe("A");
    expect(labels![graph.nodeId.indexOf("b")]).toBe("");
  });
});
