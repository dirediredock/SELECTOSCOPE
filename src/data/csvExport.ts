// The graph on screen as the CSVs Build from CSV reads: its edge list, and
// its labels and own layouts where it has them, named as in a dataset folder
// (public/datasets/). The graph as cleaned: one row per edge it kept, ids as
// written, and the own layouts as the graph holds them, in the unit bounding
// sphere. A 2D derived from the 3D goes out too, as a 2D of its own.

import { FILE_NAMES } from "../pipeline/ingest";
import { coords } from "./format";
import type { Graph } from "./graph";
import type { ZipFile } from "./zip";

// RFC 4180: a cell with a comma, a quote or a line end goes in quotes, its
// quotes doubled; what pipeline/csv.ts reads back as written.
const cell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);

const table = (header: string[], rows: string[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";

function layout(g: Graph, xy: Float32Array, dim: number): string {
  const c = coords(xy);
  const axes = ["x", "y", "z"].slice(0, dim);
  return table(
    ["node_id", ...axes],
    g.nodeId.map((id, v) => [id, ...axes.map((_, k) => String(c[v * dim + k]))]),
  );
}

export function csvFiles(g: Graph): ZipFile[] {
  // In the order of the edge list they came from.
  const edges = Array.from(g.edgeRow.keys()).sort((a, b) => g.edgeRow[a] - g.edgeRow[b]);
  const files: ZipFile[] = [
    {
      name: FILE_NAMES.edgelist,
      text: table(
        ["source", "target"],
        edges.map((e) => [g.nodeId[g.edgeSource[e]], g.nodeId[g.edgeTarget[e]]]),
      ),
    },
  ];
  // Labels may be partial: an unlabeled node has no row.
  if (g.hasLabels)
    files.push({
      name: FILE_NAMES.labels,
      text: table(
        ["node_id", "label"],
        g.nodeId.flatMap((id, v) => (g.labels[v] ? [[id, g.labels[v]]] : [])),
      ),
    });
  if (g.layoutOwn2d) files.push({ name: FILE_NAMES.layout2d, text: layout(g, g.layoutOwn2d, 2) });
  if (g.layoutOwn3d) files.push({ name: FILE_NAMES.layout3d, text: layout(g, g.layoutOwn3d, 3) });
  return files;
}
