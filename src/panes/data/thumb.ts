import type { Graph } from "../../data/graph";
import { boundsOf } from "../../canvas/bounds";

// The Data pane's thumbnails: each dataset's 2D layout (FD when it has none),
// edges only, fitted as NodeLink fits its 2D view. Baked with the builds by
// scripts/bake.ts into public/builds/thumbs/<name>.bin, and drawn by the pane
// in the current theme's ink.
//
// The file, little-endian:
//   Uint32  version, n, m
//   Uint16  x, y per node, in the unit square (y down), quantised to 0..65535
//   Uint16  source, target per edge (Uint32 past 65536 nodes)

const VERSION = 1;
const HEAD = 3;
const Q = 65535;

// NodeLink's fitted view: the drawing at 85% of the pane, centred.
const FIT = 0.85;

export interface Thumb {
  n: number;
  m: number;
  xy: Uint16Array;
  edges: Uint16Array | Uint32Array;
}

export function bakeThumb(g: Graph): Uint8Array {
  const xy = (g.layoutOwn2d ?? g.layoutFd)!;
  const { x0, x1, y0, y1 } = boundsOf(xy, g.n);
  const s = FIT / Math.max(x1 - x0, y1 - y0, 1e-12);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const q = (t: number) => Math.round(Math.min(1, Math.max(0, t)) * Q);

  const wide = g.n > 65536;
  const bytes = new Uint8Array(4 * HEAD + 4 * g.n + (wide ? 8 : 4) * g.m);
  new Uint32Array(bytes.buffer, 0, HEAD).set([VERSION, g.n, g.m]);

  const pos = new Uint16Array(bytes.buffer, 4 * HEAD, 2 * g.n);
  for (let v = 0; v < g.n; v++) {
    pos[2 * v] = q(0.5 + (xy[2 * v]! - cx) * s);
    pos[2 * v + 1] = q(0.5 - (xy[2 * v + 1]! - cy) * s);
  }

  const edges = wide
    ? new Uint32Array(bytes.buffer, 4 * HEAD + 4 * g.n, 2 * g.m)
    : new Uint16Array(bytes.buffer, 4 * HEAD + 4 * g.n, 2 * g.m);
  for (let e = 0; e < g.m; e++) {
    edges[2 * e] = g.edgeSource[e]!;
    edges[2 * e + 1] = g.edgeTarget[e]!;
  }
  return bytes;
}

export function parseThumb(buffer: ArrayBuffer): Thumb {
  const [version, n, m] = new Uint32Array(buffer, 0, HEAD);
  if (version !== VERSION) throw new Error(`Unsupported thumbnail version ${version}`);
  const xy = new Uint16Array(buffer, 4 * HEAD, 2 * n!);
  const edges = n! > 65536
    ? new Uint32Array(buffer, 4 * HEAD + 4 * n!, 2 * m!)
    : new Uint16Array(buffer, 4 * HEAD + 4 * n!, 2 * m!);
  return { n: n!, m: m!, xy, edges };
}

// An uploaded dataset's thumbnail, made in the browser from its graph, as the
// bake makes a curated one: null until its 2D layout (or FD) is in. Keyed by
// that layout, which lands once, so a tile redrawn reuses it.
const made = new WeakMap<Float32Array, Thumb>();

export function thumbOf(g: Graph): Thumb | null {
  const xy = g.layoutOwn2d ?? g.layoutFd;
  if (!xy) return null;
  let thumb = made.get(xy);
  if (!thumb) {
    thumb = parseThumb(bakeThumb(g).buffer as ArrayBuffer);
    made.set(xy, thumb);
  }
  return thumb;
}

// A tile fetches its thumbnail once; every later tile for it shares the result.
const cache = new Map<string, Promise<Thumb>>();

export function fetchThumb(name: string): Promise<Thumb> {
  let thumb = cache.get(name);
  if (!thumb) {
    thumb = fetch(`builds/thumbs/${name}.bin`).then(async (res) => {
      if (!res.ok) throw new Error(`thumbs/${name}.bin: HTTP ${res.status}`);
      return parseThumb(await res.arrayBuffer());
    });
    cache.set(name, thumb);
  }
  return thumb;
}

// Every edge as a half-pixel line in `color`, at full strength, into a size x size
// square (CSS px). A dense graph fills in as a silhouette, and every tile
// reads in one colour.
export function drawThumb(ctx: CanvasRenderingContext2D, t: Thumb, size: number, color: string) {
  const k = size / Q;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < t.m; i++) {
    const u = t.edges[2 * i]!, v = t.edges[2 * i + 1]!;
    ctx.moveTo(t.xy[2 * u]! * k, t.xy[2 * u + 1]! * k);
    ctx.lineTo(t.xy[2 * v]! * k, t.xy[2 * v + 1]! * k);
  }
  ctx.stroke();
}
