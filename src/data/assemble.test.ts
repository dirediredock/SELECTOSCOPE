import { describe, expect, it } from "vitest";
import { attach } from "../pipeline/ingest";
import { withFiles } from "./assemble";
import { testBuild } from "./testBuild";

const edgelist = ["source,target", "a,b", "b,c", "c,d", "d,a", "a,c"].join("\n");
const csv = (header: string, rows: string[]) => [header, ...rows].join("\n");

describe("withFiles", () => {
  const base = testBuild({ edgelist }, "user", "Square", null);

  it("lays labels over a built graph by node id, leaving the graph as it was", () => {
    const labels = csv("node_id,label", ["a,Ann", "c,Cy"]);
    const att = attach(base.nodeId, { labels });
    const g = withFiles(base, att, ["labels"]);
    expect(g).not.toBe(base);
    expect(g.hasLabels).toBe(true);
    expect(g.labels[base.nodeId.indexOf("a")]).toBe("Ann");
    expect(g.labels[base.nodeId.indexOf("b")]).toBe("");
    expect(g.warnings).toEqual([{ kind: "labels", reason: "2 nodes with no label" }]);
    // Every stage is shared, none computed again.
    expect(g.harmonics).toBe(base.harmonics);
    expect(g.layoutFd).toBe(base.layoutFd);
    expect(base.hasLabels).toBe(false);
  });

  it("refuses a file naming nodes the graph lacks, keeping the graph's own", () => {
    const att = attach(base.nodeId, { labels: csv("node_id,label", ["z,Zed"]) });
    const g = withFiles(base, att, ["labels"]);
    expect(g.hasLabels).toBe(false);
    expect(g.refused).toEqual([{ kind: "labels", reason: "1 node_id not in the edge list" }]);
  });

  it("derives the 2D from a 3D file, and a 2D file wins over it", () => {
    const rows3 = ["a,0,0,0", "b,1,0,0", "c,1,1,1", "d,0,1,0"];
    const g3 = withFiles(base, attach(base.nodeId, { layout3d: csv("node_id,x,y,z", rows3) }), ["layout3d"]);
    expect(g3.layoutOwn3d).not.toBeNull();
    expect(g3.layoutOwn2dOrigin).toBe("derived");
    const rows2 = ["a,0,0", "b,1,0", "c,1,1", "d,0,1"];
    const both = attach(base.nodeId, { layout2d: csv("node_id,x,y", rows2), layout3d: csv("node_id,x,y,z", rows3) });
    const g = withFiles(base, both, ["layout2d", "layout3d"]);
    expect(g.layoutOwn2dOrigin).toBe("bespoke");
    expect(g.layoutOwn3d).not.toBeNull();
  });
});
