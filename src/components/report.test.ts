import { describe, expect, it } from "vitest";
import { describeReport, fileLines, reportTip } from "./report";

const clean = { rows: 10, selfLoops: 0, repeated: 0, components: 1, droppedNodes: 0, droppedEdges: 0 };

describe("describeReport", () => {
  it("groups by file, the refused first, then the rest in file order", () => {
    const groups = describeReport({
      report: { ...clean, selfLoops: 2, repeated: 1, components: 3, droppedNodes: 4, droppedEdges: 5 },
      refused: [
        { kind: "layout2d", reason: "1 node with no row" },
        { kind: "labels", reason: "2 node_ids not in the edge list" },
      ],
      warnings: [],
    });
    expect(groups).toEqual([
      { kind: "labels", refused: true, lines: ["2 node_ids not in the edge list"] },
      { kind: "layout2d", refused: true, lines: ["1 node with no row"] },
      {
        kind: "edgelist",
        refused: false,
        lines: [
          "2 self-loops dropped",
          "1 repeated edge merged",
          "kept the largest of 3 components (4 nodes, 5 edges dropped)",
        ],
      },
    ]);
  });

  it("puts a warning under its own file", () => {
    const groups = describeReport({
      report: { ...clean, repeated: 1 },
      refused: [],
      warnings: [{ kind: "labels", reason: "3 nodes with no label" }],
    });
    expect(groups).toEqual([
      { kind: "edgelist", refused: false, lines: ["1 repeated edge merged"] },
      { kind: "labels", refused: false, lines: ["3 nodes with no label"] },
    ]);
  });

  it("has nothing to say about a clean build", () => {
    expect(describeReport({ report: clean, refused: [], warnings: [] })).toEqual([]);
  });
});

describe("fileLines", () => {
  const graph = {
    report: { ...clean, selfLoops: 1 },
    refused: [{ kind: "labels" as const, reason: "1 repeated node_id" }],
    warnings: [{ kind: "labels" as const, reason: "3 nodes with no label" }],
  };

  it("keeps each file's own lines, the refused apart from the notes", () => {
    expect(fileLines("labels", graph)).toEqual({ refused: ["1 repeated node_id"], notes: ["3 nodes with no label"] });
    expect(fileLines("edgelist", graph)).toEqual({ refused: [], notes: ["1 self-loop dropped"] });
    expect(fileLines("layout2d", graph)).toEqual({ refused: [], notes: [] });
  });

  it("puts the edge list's own refusal first, and reads nothing without a graph", () => {
    expect(fileLines("edgelist", null, "no source column")).toEqual({ refused: ["no source column"], notes: [] });
    expect(fileLines("labels", null)).toEqual({ refused: [], notes: [] });
  });
});

describe("reportTip", () => {
  it("heads with the role and the file's own name, refused lines first", () => {
    const blocks = reportTip({ role: "Labels", file: "my_labels.csv" }, { refused: ["1 repeated node_id"], notes: ["3 nodes with no label"] });
    expect(blocks).toEqual([
      { kind: "head", role: "Labels", file: "my_labels.csv", counts: null },
      {
        kind: "lines",
        lines: [
          { text: "Refused: 1 repeated node_id.", refused: true },
          { text: "3 nodes with no label.", refused: false },
        ],
      },
    ]);
  });

  it("gives the edge list its counts", () => {
    const blocks = reportTip({ role: "Edgelist", file: "edges.csv", counts: "34 / 78" }, { refused: [], notes: ["1 self-loop dropped"] });
    expect(blocks?.[0]).toEqual({ kind: "head", role: "Edgelist", file: "edges.csv", counts: "34 / 78" });
    expect(blocks?.at(-1)).toEqual({ kind: "lines", lines: [{ text: "1 self-loop dropped.", refused: false }] });
  });

  it("is null with nothing to report, so the pill has no tip", () => {
    expect(reportTip({ role: "Labels", file: "labels.csv" }, { refused: [], notes: [] })).toBe(null);
  });
});
