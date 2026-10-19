import { HAIRLINE } from "../../canvas/ink";
import type { Ink } from "../../canvas/ink";
import type { PointView } from "../../canvas/pointView";
import { hoveredNodes } from "../../state/selection";
import type { HoverItem } from "../../state/selection";
import { onionStride } from "./geometry";
import type { SnakeHeights, SnakeStructure } from "./geometry";

// Drawing only: Cores knows nothing of gestures. Node positions come from the
// view (`view.pos`, screen px), everything else is projected through it.

// A pill on screen: its members, centre and half extents, px.
export interface ScenePill {
  members: Uint32Array;
  x: number;
  y: number;
  hw: number;
  hh: number;
}

export interface SnakeScene {
  view: PointView;
  st: SnakeStructure;
  heights: SnakeHeights;
  islands: Uint32Array[]; // each island's members, in the order the tubes run
  pills: ScenePill[];
  inPill: Uint8Array | null; // node -> drawn as part of a pill, not a dot
  cuts: number[][] | null; // each row's bin boundaries, x at 100%; null hides them
  tube: number; // island width, outline included, px
  r: number; // node radius, px
  stepPx: number; // one onion layer on screen
  w: number;
  h: number;
  gutter: { left: number; right: number };
  source: Uint32Array;
  target: Uint32Array;
}

const FAMILY = '"Roboto Condensed", system-ui, sans-serif';
const FONT = `11px ${FAMILY}`;

// A pill's count is small, quiet text, never above the pane's axis text; below
// the legible minimum the pill is drawn blank.
const PILL_TEXT_MIN = 7;
const PILL_TEXT_MAX = 10;
export const pillFontPx = (hh: number) => Math.min(PILL_TEXT_MAX, Math.round(2 * hh - 5));
const pillHasText = (hh: number) => pillFontPx(hh) >= PILL_TEXT_MIN;
// Roboto Condensed's digits run about this wide per px of font size. A short
// count leaves a circle; a longer one stretches the capsule just past it.
export const pillHalfWidth = (hh: number, text: string) =>
  pillHasText(hh) ? Math.max(hh, (text.length * pillFontPx(hh) * 0.52) / 2 + 0.6 * hh) : hh;

function fillNodes(
  ctx: CanvasRenderingContext2D,
  pos: Float32Array,
  nodes: Iterable<number>,
  r: number,
  skip: Uint8Array | null = null,
) {
  ctx.beginPath();
  for (const v of nodes) {
    if (skip?.[v]) continue;
    const x = pos[2 * v]!, y = pos[2 * v + 1]!;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
  ctx.fill();
}

function strokeChords(ctx: CanvasRenderingContext2D, s: SnakeScene, edges: Iterable<number>) {
  const p = s.view.pos;
  ctx.beginPath();
  for (const e of edges) {
    const u = s.source[e]!, v = s.target[e]!;
    ctx.moveTo(p[2 * u]!, p[2 * u + 1]!);
    ctx.lineTo(p[2 * v]!, p[2 * v + 1]!);
  }
  ctx.stroke();
}

// Islands: a tube along the snake through the members, in x order, a gray
// hairline around a panel-coloured interior. Each tube is finished before the
// next, so neighbours that touch keep their own outlines. A single node is not
// enclosed.
function drawTubes(ctx: CanvasRenderingContext2D, s: SnakeScene, ink: Ink) {
  const p = s.view.pos;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const g of s.islands) {
    if (g.length === 1) continue;
    ctx.beginPath();
    g.forEach((v, i) => (i ? ctx.lineTo(p[2 * v]!, p[2 * v + 1]!) : ctx.moveTo(p[2 * v]!, p[2 * v + 1]!)));
    ctx.strokeStyle = ink.frame;
    ctx.lineWidth = s.tube;
    ctx.stroke();
    ctx.strokeStyle = ink.panel;
    ctx.lineWidth = s.tube - 2 * HAIRLINE;
    ctx.stroke();
  }
}

// A capsule around a pill, grown by `grow` px all round.
function capsule(ctx: CanvasRenderingContext2D, p: ScenePill, grow = 0, hw = p.hw) {
  const h = p.hh + grow, w = hw + grow;
  ctx.beginPath();
  ctx.roundRect(p.x - w, p.y - h, 2 * w, 2 * h, h);
}

function pillText(ctx: CanvasRenderingContext2D, p: ScenePill, text: string, colour: string) {
  if (!pillHasText(p.hh)) return;
  ctx.font = `500 ${pillFontPx(p.hh)}px ${FAMILY}`;
  ctx.textAlign = "center";
  // Centred on the digits' own height, not the em box, so they sit dead centre.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colour;
  ctx.fillText(text, p.x, p.y + ctx.measureText(text).actualBoundingBoxAscent / 2);
}

export function drawBase(ctx: CanvasRenderingContext2D, s: SnakeScene, ink: Ink) {
  // K span delimiters, the outer two included, run across the whole pane; bin
  // boundaries, each row's two ends included, across each band, from
  // delimiter to delimiter.
  ctx.strokeStyle = ink.grid;
  ctx.lineWidth = HAIRLINE;
  ctx.beginPath();
  for (const y of s.heights.delimiters) {
    const sy = Math.round(s.view.project(0, y)[1]) + 0.5;
    ctx.moveTo(0, sy);
    ctx.lineTo(s.w, sy);
  }
  s.cuts?.forEach((xs, row) => {
    const [y0, y1] = s.heights.bands[row]!;
    for (const x of xs) {
      const [sx, sy0] = s.view.project(x, y0);
      const sy1 = s.view.project(x, y1)[1];
      ctx.moveTo(Math.round(sx) + 0.5, sy0);
      ctx.lineTo(Math.round(sx) + 0.5, sy1);
    }
  });
  ctx.stroke();
  drawTubes(ctx, s, ink);
  ctx.fillStyle = ink.markNode;
  fillNodes(ctx, s.view.pos, range(s.st.n), s.r, s.inPill);
  // Pills: a hairline like an island's around a panel-coloured interior.
  for (const p of s.pills) {
    capsule(ctx, p);
    ctx.fillStyle = ink.panel;
    ctx.fill();
    ctx.strokeStyle = ink.frame;
    ctx.lineWidth = HAIRLINE;
    ctx.stroke();
    pillText(ctx, p, String(p.members.length), ink.muted);
  }
}

function* range(n: number) {
  for (let v = 0; v < n; v++) yield v;
}

// Onion layers on the left, K spans on the right, in gutters pinned to the
// pane's edges that follow the vertical pan and zoom. A panel-coloured halo
// keeps them legible over the pattern.
export function drawAxes(ctx: CanvasRenderingContext2D, s: SnakeScene, ink: Ink) {
  ctx.font = FONT;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink.panel;
  ctx.fillStyle = ink.muted;
  const text = (t: string, x: number, y: number) => {
    ctx.strokeText(t, x, y);
    ctx.fillText(t, x, y);
  };
  const onScreen = (y: number) => y > -8 && y < s.h + 8;

  ctx.textAlign = "right";
  const stride = onionStride(s.stepPx);
  const { onionY } = s.heights;
  for (let o = s.st.minOnion; o <= s.st.maxOnion; o++) {
    if (o % stride) continue;
    const y = s.view.project(0, onionY[o]!)[1];
    if (onScreen(y)) text(String(o), s.gutter.left - 6, y);
  }

  ctx.textAlign = "left";
  let last = Infinity;
  for (const span of s.heights.spans) {
    const y = s.view.project(0, (span.y0 + span.y1) / 2)[1];
    if (!onScreen(y) || Math.abs(last - y) < 12) continue;
    text(`K${span.k}`, s.w - s.gutter.right + 6, y);
    last = y;
  }
}

export function drawSets(
  ctx: CanvasRenderingContext2D,
  s: SnakeScene,
  ink: Ink,
  nodes: ReadonlySet<number>,
  edges: ReadonlySet<number>,
) {
  if (edges.size) {
    ctx.strokeStyle = ink.edge;
    ctx.lineWidth = 1.5;
    strokeChords(ctx, s, edges);
  }
  if (nodes.size) {
    // A panel-coloured halo keeps blue nodes distinct where they overlap.
    ctx.fillStyle = ink.panel;
    fillNodes(ctx, s.view.pos, nodes, s.r + 2, s.inPill);
    ctx.fillStyle = ink.node;
    fillNodes(ctx, s.view.pos, nodes, s.r + 1, s.inPill);
    // A pill with any member in the set turns blue, reading how many of how
    // many; all of them, just the count.
    for (const p of s.pills) {
      let k = 0;
      for (const v of p.members) if (nodes.has(v)) k++;
      if (!k) continue;
      const text = k === p.members.length ? String(k) : `${k}/${p.members.length}`;
      const hw = Math.max(p.hw, pillHalfWidth(p.hh, text));
      capsule(ctx, p, 1, hw);
      ctx.fillStyle = ink.panel;
      ctx.fill();
      capsule(ctx, p, 0, hw);
      ctx.fillStyle = ink.node;
      ctx.fill();
      pillText(ctx, p, text, ink.panel);
    }
  }
}

export function drawHover(ctx: CanvasRenderingContext2D, s: SnakeScene, ink: Ink, hovered: HoverItem | null) {
  if (!hovered) return;
  if (hovered.type === "edge") {
    ctx.strokeStyle = ink.hover;
    ctx.lineWidth = 3;
    strokeChords(ctx, s, [hovered.id]);
    return;
  }
  const nodes = hoveredNodes(hovered);
  ctx.fillStyle = ink.panel;
  fillNodes(ctx, s.view.pos, nodes, s.r + 5, s.inPill);
  ctx.fillStyle = ink.hover;
  fillNodes(ctx, s.view.pos, nodes, s.r + 3.5, s.inPill);
  // The pill hovered as a whole turns red; one hovered elsewhere that is
  // among its members gets a red ring.
  if (!s.inPill) return;
  const lit = new Set(nodes);
  for (const p of s.pills) {
    const k = p.members.reduce((t, v) => t + (lit.has(v) ? 1 : 0), 0);
    if (!k) continue;
    if (k === p.members.length) {
      capsule(ctx, p, 2);
      ctx.fillStyle = ink.panel;
      ctx.fill();
      capsule(ctx, p, 1);
      ctx.fillStyle = ink.hover;
      ctx.fill();
      pillText(ctx, p, String(k), ink.panel);
    } else {
      capsule(ctx, p, 2.5);
      ctx.strokeStyle = ink.hover;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
