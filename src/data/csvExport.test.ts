import { describe, expect, it } from "vitest";
import { buildNow } from "./assemble";
import { csvFiles } from "./csvExport";
import type { Graph } from "./graph";

const csv = (header: string, rows: string[]) => [header, ...rows].join("\n");

// The pentagon a..e with a chord, a loop, a repeat and a stray component
// for the cleaning to drop.
const edgelist = csv("source,target", ["a,b", "b,c", "c,d", "d,e", "e,a", "a,c", "c,c", "b,a", "x,y"]);
const labels = csv("node_id,label", ["a,Ann", 'b,"Smith, ""Bo"""', "c,Cy"]);
const ids = ["a", "b", "c", "d", "e"];
const layout2d = csv("node_id,x,y", ids.map((id, i) => `${id},${Math.cos(i)},${Math.sin(i)}`));
const layout3d = csv("node_id,x,y,z", ids.map((id, i) => `${id},${i},${i * i},${-i}`));

const exported = (g: Graph) => Object.fromEntries(csvFiles(g).map((f) => [f.name, f.text]));

const rebuild = (files: Record<string, string>) =>
  buildNow(
    {
      edgelist: files["edgelist.csv"],
      labels: files["labels.csv"],
      layout2d: files["layout_2d.csv"],
      layout3d: files["layout_3d.csv"],
    },
    "user",
    "Again",
    null,
  );

const edgeSet = (g: Graph) =>
  new Set(Array.from(g.edgeSource, (s, e) => [g.nodeId[s], g.nodeId[g.edgeTarget[e]]].sort().join("-")));

const byId = (g: Graph, xy: Float32Array, dim: number) =>
  new Map(g.nodeId.map((id, v) => [id, Array.from(xy.subarray(v * dim, (v + 1) * dim))]));

function expectLayout(a: Graph, ax: Float32Array, b: Graph, bx: Float32Array, dim: number) {
  const want = byId(a, ax, dim);
  for (const [id, xyz] of byId(b, bx, dim)) xyz.forEach((x, k) => expect(x).toBeCloseTo(want.get(id)![k], 4));
}

describe("csvFiles", () => {
  it("writes the cleaned graph's files, which build back the same graph", () => {
    const g = buildNow({ edgelist, labels, layout2d, layout3d }, "user", "Pentagon", null);
    const files = exported(g);
    expect(Object.keys(files)).toEqual(["edgelist.csv", "labels.csv", "layout_2d.csv", "layout_3d.csv"]);
    // One row per edge kept, in the file's order; direction is the graph's.
    const rows = files["edgelist.csv"].split("\n");
    expect(rows[0]).toBe("source,target");
    expect(rows.slice(1, 4).map((r) => r.split(",").sort().join(","))).toEqual(["a,b", "b,c", "c,d"]);
    expect(files["edgelist.csv"].trim().split("\n")).toHaveLength(1 + g.m);
    // Partial labels stay partial, quoted where they need it.
    expect(files["labels.csv"]).toContain('b,"Smith, ""Bo"""\n');
    expect(files["labels.csv"].trim().split("\n")).toHaveLength(4);

    const h = rebuild(files);
    expect(h.report).toMatchObject({ selfLoops: 0, repeated: 0, components: 1 });
    expect(new Set(h.nodeId)).toEqual(new Set(g.nodeId));
    expect(edgeSet(h)).toEqual(edgeSet(g));
    const labelOf = (x: Graph) => new Map(x.nodeId.map((id, v) => [id, x.labels[v]]));
    expect(labelOf(h)).toEqual(labelOf(g));
    expectLayout(g, g.layoutOwn2d!, h, h.layoutOwn2d!, 2);
    expectLayout(g, g.layoutOwn3d!, h, h.layoutOwn3d!, 3);
  });

  it("writes a 2D derived from the 3D as a 2D of its own", () => {
    const g = buildNow({ edgelist, layout3d }, "user", "Pentagon", null);
    expect(g.layoutOwn2dOrigin).toBe("derived");
    const files = exported(g);
    expect(Object.keys(files)).toEqual(["edgelist.csv", "layout_2d.csv", "layout_3d.csv"]);
    const h = rebuild(files);
    expect(h.layoutOwn2dOrigin).toBe("bespoke");
    expectLayout(g, g.layoutOwn2d!, h, h.layoutOwn2d!, 2);
  });

  it("writes the edge list alone for a graph with nothing else", () => {
    const g = buildNow({ edgelist }, "user", "Pentagon", null);
    expect(Object.keys(exported(g))).toEqual(["edgelist.csv"]);
  });
});
