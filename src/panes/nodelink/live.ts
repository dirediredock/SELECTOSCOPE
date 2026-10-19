import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3-force";
import type { SimulationNodeDatum } from "d3-force";
import { boundsOf } from "../../canvas/pointView";
import type { Bounds } from "../../canvas/pointView";
import type { Graph } from "../../data/graph";

// The live 2D force simulation, started from the 2D layout. It cools and stops
// by itself (about 300 ticks); a restart begins again from the 2D layout, so a
// run is reproducible. Positions come back in layout units.
//
// A node can be dragged, alone or with a group pinned rigidly to it; a group
// is just its members dragged at once. A drag warms the simulation so
// neighbours follow. On release each node springs free, but an anchor holds it
// where it was dropped, so the layout keeps the user's placement while they
// rearrange other nodes. The anchor loosens over a minute, and the simulation
// stays gently warm meanwhile, so the node drifts back to where the forces
// alone would put it; it cools once the last anchor is gone.

export interface LiveSim {
  xy: Float32Array; // [x0, y0, ...], updated every tick
  // The extent the view fits to. It only grows while the simulation spreads,
  // so the view zooms out smoothly and never jumps back in. Once a node is
  // dragged it holds still for the rest of the run: the user is arranging,
  // and the view must not move under them (Figma). Fit all still fits.
  bounds: Bounds;
  fitToCurrent(): void; // shrink-wrap the extent to the positions now (Fit all)
  // Pin a node, and any group with it, where they are and warm the simulation.
  grab(v: number, group?: Iterable<number>): void;
  dragTo(x: number, y: number): void; // move the held node, the group keeping its offsets (layout units)
  release(): void; // let the held nodes go, anchored where they were dropped
  stop(): void;
}

function grow(b: Bounds, by: Bounds) {
  b.x0 = Math.min(b.x0, by.x0);
  b.x1 = Math.max(b.x1, by.x1);
  b.y0 = Math.min(b.y0, by.y0);
  b.y1 = Math.max(b.y1, by.y1);
}

// d3-force's default link distance. The layout is scaled so its median edge
// has this length, and the default forces then act at the scale they're tuned
// for, whatever the layout's units.
const LINK_DISTANCE = 30;

// How warm the simulation runs while a node is held (d3's usual drag value),
// and while any dropped node is still anchored: warm enough to follow the
// fading anchors, cool enough that nothing else visibly churns.
const DRAG_ALPHA = 0.3;
const ANCHORED_ALPHA = 0.05;

// A dropped node's anchor is a blend, not a pull: each tick the node lands
// this share of the way from where the forces would take it back to the drop
// point. At 1 it is pinned; a force would lose to a hub's many links and let
// it snap back on release. The share falls to 0 over ANCHOR_HOLD_MS, fast at
// first, while the anchor is still far stiffer than the forces, so the node
// leaves its spot gradually across the whole minute. An anchor's age counts
// ticks, not the clock, so a stalled frame (a background tab) never ages it.
export const ANCHOR_HOLD_MS = 60_000;
const MAX_TICK_MS = 100;

export const anchorHold = (ageMs: number) => {
  const t = Math.min(1, Math.max(0, ageMs / ANCHOR_HOLD_MS));
  return (1 - t) ** 3;
};

function medianEdgeLength(g: Graph, xy: Float32Array): number {
  const lengths = new Float64Array(g.m);
  for (let e = 0; e < g.m; e++) {
    const u = g.edgeSource[e]!, v = g.edgeTarget[e]!;
    lengths[e] = Math.hypot(xy[2 * u]! - xy[2 * v]!, xy[2 * u + 1]! - xy[2 * v + 1]!);
  }
  lengths.sort();
  return lengths[g.m >> 1]! || 1;
}

// Starts from `start`, the positions on screen ([x0, y0, ...], layout units).
export function startLive(g: Graph, start: Float32Array, onTick: () => void): LiveSim {
  const scale = LINK_DISTANCE / medianEdgeLength(g, start);
  const nodes: SimulationNodeDatum[] = Array.from({ length: g.n }, (_, v) => ({
    x: start[2 * v]! * scale,
    y: start[2 * v + 1]! * scale,
  }));
  const links = Array.from({ length: g.m }, (_, e) => ({ source: g.edgeSource[e]!, target: g.edgeTarget[e]! }));
  const bounds = boundsOf(start, g.n);
  const xy = Float32Array.from(start);
  // Simulation units, keyed by node.
  const anchors = new Map<number, { x: number; y: number; age: number }>();
  // The grabbed node first, then the rest of its group, with each one's offset
  // from it (simulation units).
  let held: { nodes: number[]; ox: Float64Array; oy: Float64Array } | null = null;
  let placed = false; // a node has been dragged this run
  let lastTick: number | null = null;

  const settle = () => {
    sim.alphaTarget(held ? DRAG_ALPHA : anchors.size ? ANCHORED_ALPHA : 0);
  };

  // Runs after the other forces (it is added last): it sets the velocity
  // that lands the node on the blend of its free next position and the
  // drop point.
  const anchor = () => {
    const now = performance.now();
    const dt = lastTick === null ? 0 : Math.min(now - lastTick, MAX_TICK_MS);
    lastTick = now;
    const keep = 1 - sim.velocityDecay();
    let expired = false;
    for (const [v, a] of anchors) {
      const d = nodes[v]!;
      a.age += dt;
      const w = anchorHold(a.age);
      if (w === 0) {
        anchors.delete(v);
        expired = true;
        continue;
      }
      const fx = d.x! + d.vx! * keep, fy = d.y! + d.vy! * keep;
      d.vx = (fx + (a.x - fx) * w - d.x!) / keep;
      d.vy = (fy + (a.y - fy) * w - d.y!) / keep;
    }
    if (expired) settle();
  };

  const sim = forceSimulation(nodes)
    .force("link", forceLink(links))
    .force("charge", forceManyBody())
    .force("center", forceCenter(((bounds.x0 + bounds.x1) / 2) * scale, ((bounds.y0 + bounds.y1) / 2) * scale))
    .force("anchor", anchor)
    .on("tick", () => {
      for (let v = 0; v < g.n; v++) {
        xy[2 * v] = nodes[v]!.x! / scale;
        xy[2 * v + 1] = nodes[v]!.y! / scale;
      }
      if (!placed) grow(bounds, boundsOf(xy, g.n));
      onTick();
    });

  return {
    xy,
    bounds,
    fitToCurrent: () => Object.assign(bounds, boundsOf(xy, g.n)),
    grab(v, group = []) {
      const list = [v, ...[...new Set(group)].filter((u) => u !== v)];
      const ox = new Float64Array(list.length), oy = new Float64Array(list.length);
      const c = nodes[v]!;
      list.forEach((u, i) => {
        const d = nodes[u]!;
        d.fx = d.x;
        d.fy = d.y;
        ox[i] = d.x! - c.x!;
        oy[i] = d.y! - c.y!;
        anchors.delete(u);
      });
      held = { nodes: list, ox, oy };
      placed = true;
      settle();
      sim.restart();
    },
    dragTo(x, y) {
      if (held === null) return;
      held.nodes.forEach((u, i) => {
        const d = nodes[u]!;
        d.fx = x * scale + held!.ox[i]!;
        d.fy = y * scale + held!.oy[i]!;
        xy[2 * u] = d.fx / scale;
        xy[2 * u + 1] = d.fy / scale;
      });
    },
    release() {
      if (held === null) return;
      for (const u of held.nodes) {
        const d = nodes[u]!;
        anchors.set(u, { x: d.fx!, y: d.fy!, age: 0 });
        d.fx = null;
        d.fy = null;
      }
      held = null;
      settle();
    },
    stop: () => sim.stop(),
  };
}
