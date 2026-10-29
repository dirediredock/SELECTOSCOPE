import type { Ink } from "../../canvas/ink";
import type { PointView } from "../../canvas/pointView";
import { hoveredNodes } from "../../state/hover";
import type { HoverItem } from "../../state/hover";
import { strideFor } from "./geometry";
import type { CensusPlacement } from "./geometry";

// Drawing only: Hops knows nothing of gestures. Line vertices come from
// the view (`view.pos`, screen px), everything else is projected through it.
// It shows nodes only: the edge set and a hovered edge leave it unchanged,
// and a sweep shows only its nodes.

export interface CensusScene {
  view: PointView;
  placement: CensusPlacement;
  offset: Uint32Array; // node v's line is vertices offset[v] .. offset[v + 1]
  n: number;
  w: number;
  h: number;
  gutter: number; // px at the right for the E labels
}

const FONT = '11px "Roboto Condensed", system-ui, sans-serif';
const LABEL_MIN_PX = 12;

function traceLine(ctx: CanvasRenderingContext2D, s: CensusScene, v: number) {
  const p = s.view.pos;
  const first = s.offset[v]!, last = s.offset[v + 1]!;
  ctx.moveTo(p[2 * first]!, p[2 * first + 1]!);
  for (let i = first + 1; i < last; i++) ctx.lineTo(p[2 * i]!, p[2 * i + 1]!);
}

function strokeLines(ctx: CanvasRenderingContext2D, s: CensusScene, nodes: Iterable<number>) {
  ctx.beginPath();
  for (const v of nodes) traceLine(ctx, s, v);
  ctx.stroke();
}

export function drawBase(ctx: CanvasRenderingContext2D, s: CensusScene, ink: Ink) {
  // One stroke per line, in node_id order, so overlaps build up and identical
  // lines draw identically.
  ctx.strokeStyle = ink.markNode;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (let v = 0; v < s.n; v++) {
    ctx.beginPath();
    traceLine(ctx, s, v);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// E labels, each centred on its bin, in a gutter pinned to the pane's right
// edge that follows the vertical pan and zoom. The number is the bin's
// eccentricity: how many hops its lines span.
export function drawAxes(ctx: CanvasRenderingContext2D, s: CensusScene, ink: Ink) {
  const { bins } = s.placement;
  if (!bins.length) return;
  ctx.font = FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink.panel;
  ctx.fillStyle = ink.muted;
  const pitch = bins.length > 1 ? (bins[0]!.y0 - bins[1]!.y0) * s.view.pxPerUnit : Infinity;
  const stride = strideFor(pitch, LABEL_MIN_PX);
  bins.forEach((bin, r) => {
    if (r % stride) return;
    const y = s.view.project(0, (bin.y0 + bin.y1) / 2)[1];
    if (y < -8 || y > s.h + 8) return;
    const t = `E${bin.ecc}`;
    ctx.strokeText(t, s.w - s.gutter + 6, y);
    ctx.fillText(t, s.w - s.gutter + 6, y);
  });
}

export function drawSets(ctx: CanvasRenderingContext2D, s: CensusScene, ink: Ink, nodes: ReadonlySet<number>) {
  if (!nodes.size) return;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = ink.node;
  ctx.lineWidth = 2;
  strokeLines(ctx, s, [...nodes].sort((a, b) => a - b));
}

export function drawHover(ctx: CanvasRenderingContext2D, s: CensusScene, ink: Ink, hovered: HoverItem | null) {
  if (hovered?.type !== "node") return;
  const nodes = hoveredNodes(hovered);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // A panel-coloured halo keeps the red line distinct over the others.
  ctx.strokeStyle = ink.panel;
  ctx.lineWidth = 5;
  strokeLines(ctx, s, nodes);
  ctx.strokeStyle = ink.hover;
  ctx.lineWidth = 2.5;
  strokeLines(ctx, s, nodes);
}
