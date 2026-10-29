// The Matrix's Canvas 2D renderer. Like NodeLink's, it draws what it
// is told and knows nothing about selection gestures:
//   base    the form's outline, node gridlines (when rows are far enough
//           apart on screen), and one neutral point per edge copy
//   sets    the node set as blue rows and columns, the edge set as orange points
//   hover   a hovered edge as red points, a hovered node as a red row and column

import { HAIRLINE } from "../../canvas/ink";
import type { Ink } from "../../canvas/ink";
import type { PointView } from "../../canvas/pointView";
import { hoveredNodes } from "../../state/hover";
import type { HoverItem } from "../../state/hover";
import { nodeLines, outline } from "./geometry";
import type { MatrixPoints } from "./geometry";

// What a draw needs about the matrix on screen.
export interface MatrixScene {
  view: PointView; // pos holds the points' screen positions
  pose: number; // between the square (0) and the diamond (1), geometry.ts
  n: number;
  m: number;
  row: ArrayLike<number>; // node_id -> position, fractional mid-glide
  points: MatrixPoints;
  radius: number; // point radius, px
  cellPx: number; // row spacing on screen, px
}

// Rows closer than this on screen get no gridlines: they would merge into a
// grey wash.
const GRID_MIN_PX = 6;

function fillPoints(ctx: CanvasRenderingContext2D, pos: Float32Array, indices: Iterable<number>, r: number) {
  ctx.beginPath();
  for (const i of indices) {
    const x = pos[2 * i]!, y = pos[2 * i + 1]!;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
  ctx.fill();
}

function strokeNodeLines(ctx: CanvasRenderingContext2D, s: MatrixScene, nodes: Iterable<number>) {
  ctx.beginPath();
  for (const v of nodes) {
    const l = nodeLines(s.pose, s.n, s.row[v]!);
    for (let i = 0; i < l.length; i += 4) {
      const [x0, y0] = s.view.project(l[i]!, l[i + 1]!);
      const [x1, y1] = s.view.project(l[i + 2]!, l[i + 3]!);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
  }
  ctx.stroke();
}

// The screen points of an edge: both mirror copies.
function* pointsOf(s: MatrixScene, edges: Iterable<number>) {
  for (const e of edges) {
    yield e;
    yield s.m + e;
  }
}

function* range(n: number) {
  for (let i = 0; i < n; i++) yield i;
}

export function drawBase(ctx: CanvasRenderingContext2D, s: MatrixScene, ink: Ink) {
  const o = outline(s.pose, s.n);
  ctx.beginPath();
  for (let i = 0; i < o.length; i += 2) {
    const [x, y] = s.view.project(o[i]!, o[i + 1]!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = ink.frame;
  ctx.lineWidth = HAIRLINE;
  ctx.stroke();

  if (s.cellPx >= GRID_MIN_PX) {
    ctx.strokeStyle = ink.markEdge;
    ctx.lineWidth = 1;
    strokeNodeLines(ctx, s, range(s.n));
  }

  ctx.fillStyle = ink.markNode;
  fillPoints(ctx, s.view.pos, range(s.points.count), s.radius);
}

export function drawSets(
  ctx: CanvasRenderingContext2D,
  s: MatrixScene,
  ink: Ink,
  nodes: ReadonlySet<number>,
  edges: ReadonlySet<number>,
) {
  if (nodes.size) {
    // Rows and columns as a translucent wash, so the points stay readable.
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = ink.node;
    ctx.lineWidth = Math.max(1.5, Math.min(s.cellPx, 2 * s.radius + 1));
    strokeNodeLines(ctx, s, nodes);
    ctx.globalAlpha = 1;
  }
  if (edges.size) {
    const pts = [...pointsOf(s, edges)];
    ctx.fillStyle = ink.panel;
    fillPoints(ctx, s.view.pos, pts, s.radius + 2);
    ctx.fillStyle = ink.edge;
    fillPoints(ctx, s.view.pos, pts, s.radius + 1);
  }
}

// Hover is the loudest mark: red and larger, drawn last. A hovered edge lights
// only its own points; a hovered node (from another pane) its row and column.
export function drawHover(ctx: CanvasRenderingContext2D, s: MatrixScene, ink: Ink, hovered: HoverItem | null) {
  if (!hovered) return;
  if (hovered.type === "edge") {
    const pts = [...pointsOf(s, [hovered.id])];
    ctx.fillStyle = ink.panel;
    fillPoints(ctx, s.view.pos, pts, s.radius + 4);
    ctx.fillStyle = ink.hover;
    fillPoints(ctx, s.view.pos, pts, s.radius + 2.5);
  } else {
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = ink.hover;
    ctx.lineWidth = 1.5;
    strokeNodeLines(ctx, s, hoveredNodes(hovered));
    ctx.globalAlpha = 1;
  }
}
