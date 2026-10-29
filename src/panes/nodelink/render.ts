// NodeLink's Canvas 2D renderer. It draws what it is told and knows nothing
// about how selections are made, so it can move to WebGL later without
// touching the gesture code.
//   scene   every mark, far to near: neutral edges, the orange edge set,
//           neutral nodes, the blue node set. In 3D the marks are sorted into
//           depth buckets and far buckets fade, the
//           sets included, so a selection sits at its true depth.
//   hover   the hovered item, on its own layer so the pointer rate costs one
//           mark; drawn on top at full strength, as the loudest mark.

import type { Ink } from "../../canvas/ink";
import type { Graph } from "../../data/graph";
import { hoveredNodes } from "../../state/hover";
import type { HoverItem } from "../../state/hover";

const BUCKETS = 12;
// The far bucket's opacity in 3D; the near one is opaque.
const FAR_ALPHA = 0.2;

function strokeEdges(ctx: CanvasRenderingContext2D, g: Graph, pos: Float32Array, edges: Iterable<number>) {
  ctx.beginPath();
  for (const e of edges) {
    const u = g.edgeSource[e]!, v = g.edgeTarget[e]!;
    ctx.moveTo(pos[2 * u]!, pos[2 * u + 1]!);
    ctx.lineTo(pos[2 * v]!, pos[2 * v + 1]!);
  }
  ctx.stroke();
}

function fillNodes(ctx: CanvasRenderingContext2D, pos: Float32Array, nodes: Iterable<number>, r: number) {
  ctx.beginPath();
  for (const v of nodes) {
    const x = pos[2 * v]!, y = pos[2 * v + 1]!;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
  ctx.fill();
}

// Items grouped by bucket, far to near: a counting sort, O(items).
function bucketed(count: number, bucketOf: (i: number) => number, buckets: number) {
  const start = new Uint32Array(buckets + 1);
  const of = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    of[i] = bucketOf(i);
    start[of[i] + 1]++;
  }
  for (let b = 0; b < buckets; b++) start[b + 1] += start[b];
  const items = new Uint32Array(count);
  const fill = start.slice(0, buckets);
  for (let i = 0; i < count; i++) items[fill[of[i]]++] = i;
  return (b: number) => items.subarray(start[b]!, start[b + 1]!);
}

export interface SceneInput {
  g: Graph;
  pos: Float32Array; // screen positions, [x0, y0, ...]
  r: number;
  ink: Ink;
  nodes: ReadonlySet<number>;
  edges: ReadonlySet<number>;
  depth: Float32Array | null; // per node, in [-1, 1], larger is nearer; null in 2D
}

export function drawScene(ctx: CanvasRenderingContext2D, s: SceneInput) {
  const { g, pos, r, ink, nodes, edges, depth } = s;
  const buckets = depth ? BUCKETS : 1;
  const bucket = (z: number) => Math.min(buckets - 1, Math.max(0, Math.floor(((z + 1) / 2) * buckets)));
  const nodesIn = bucketed(g.n, depth ? (v) => bucket(depth[v]!) : () => 0, buckets);
  const edgesIn = bucketed(
    g.m,
    depth ? (e) => bucket((depth[g.edgeSource[e]!]! + depth[g.edgeTarget[e]!]!) / 2) : () => 0,
    buckets,
  );

  for (let b = 0; b < buckets; b++) {
    ctx.globalAlpha = depth ? FAR_ALPHA + ((1 - FAR_ALPHA) * (b + 1)) / buckets : 1;
    const es = edgesIn(b), vs = nodesIn(b);
    const selEdges: number[] = [], plainEdges: number[] = [];
    for (const e of es) (edges.has(e) ? selEdges : plainEdges).push(e);
    const selNodes: number[] = [], plainNodes: number[] = [];
    for (const v of vs) (nodes.has(v) ? selNodes : plainNodes).push(v);

    ctx.strokeStyle = ink.markEdge;
    ctx.lineWidth = 1;
    strokeEdges(ctx, g, pos, plainEdges);
    if (selEdges.length) {
      ctx.strokeStyle = ink.edge;
      ctx.lineWidth = 2;
      strokeEdges(ctx, g, pos, selEdges);
    }
    ctx.fillStyle = ink.markNode;
    fillNodes(ctx, pos, plainNodes, r);
    if (selNodes.length) {
      // A panel-coloured halo keeps blue nodes distinct where they overlap.
      ctx.fillStyle = ink.panel;
      fillNodes(ctx, pos, selNodes, r + 2);
      ctx.fillStyle = ink.node;
      fillNodes(ctx, pos, selNodes, r + 1);
    }
  }
  ctx.globalAlpha = 1;
}

// An edge lights only its own line, never its endpoints.
export function drawHover(
  ctx: CanvasRenderingContext2D,
  g: Graph,
  pos: Float32Array,
  r: number,
  ink: Ink,
  hovered: HoverItem | null,
) {
  if (!hovered) return;
  if (hovered.type === "edge") {
    ctx.strokeStyle = ink.hover;
    ctx.lineWidth = 3;
    strokeEdges(ctx, g, pos, [hovered.id]);
  } else {
    const nodes = hoveredNodes(hovered);
    ctx.fillStyle = ink.panel;
    fillNodes(ctx, pos, nodes, r + 5);
    ctx.fillStyle = ink.hover;
    fillNodes(ctx, pos, nodes, r + 3.5);
  }
}
