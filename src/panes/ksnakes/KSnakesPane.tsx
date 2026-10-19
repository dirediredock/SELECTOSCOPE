import { useEffect, useRef } from "react";
import { data } from "../../data/dataStore";
import { useStore } from "../../state/createStore";
import { useFadeIn } from "../../components/fadeIn";
import { WaitingOn } from "../../components/PaneMessage";
import type { Graph } from "../../data/graph";
import { hover, selection } from "../../state/selection";
import { registerSweepAxis, shownSets, sweep } from "../../state/sweep";
import { inkChanged, ui } from "../../state/uiStore";
import { K_GAP, ksnakesIn, ksnakesOf, ksnakesSettings, modeOf } from "../../state/ksnakes";
import type { KSnakesSettings } from "../../state/ksnakes";
import type { SlotId } from "../../state/layout";
import { fitRequests, setView, viewOf, views } from "../../state/views";
import { fitAll } from "../../state/fits";
import { canvasBox, sizeCanvas } from "../../canvas/sizeCanvas";
import { HAIRLINE, readInk } from "../../canvas/ink";
import { frameScheduler } from "../../canvas/frame";
import { PointView } from "../../canvas/pointView";
import { pointHitTester } from "../../interaction/pointHits";
import type { HitTester } from "../../interaction/pointHits";
import { attachSelectGesture } from "../../interaction/selectGesture";
import { attachNavigate } from "../../interaction/navigate";
import { snakeHeights, snakeStructure, snakeXY, sweepAxis, sweepAxisX } from "./geometry";
import { easeInOut, GLIDE_MS, lerpInto } from "../../canvas/glide";
import type { SnakeHeights, SnakePlacement, SnakeStructure } from "./geometry";
import { drawAxes, drawBase, drawHover, drawSets, pillHalfWidth } from "./render";
import type { ScenePill, SnakeScene } from "./render";

const GUTTER = { left: 30, right: 36 }; // px for the onion numbers and K labels
const PAD_X = 14; // px between the pattern and each gutter
const PAD_Y = 20; // px above and below the pattern at 100% zoom
const NODE_CLEAR = 1.5; // px between a dot and its island's outline

// What the nodes are placed by: one ordering in one singleton mode.
type Target = Pick<KSnakesSettings, "ordering" | "group">;
const keyOf = (t: Target) => `${t.group}/${t.ordering}`;

// Cores: each node at its onion layer's height, K spans delimited by
// hairlines, each shell a row of bins, islands enclosed and singletons
// optionally grouped into count pills, in the ordering and singleton mode
// picked in the bottom strip (ordered by the pipeline). A change of either
// glides the nodes. At 100% zoom the pattern fills the pane's height, as wide
// as Spacing says; Fit all shows it all. Five canvases, each redrawn only
// when its inputs change: base, sets, axes, hover, gesture.
export function KSnakesPane({ slot }: { slot: SlotId }) {
  const stackRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const setsRef = useRef<HTMLCanvasElement>(null);
  const axesRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stack = stackRef.current!;
    const view = new PointView();
    const frame = frameScheduler();

    let structure: { graph: Graph; st: SnakeStructure } | null = null;
    // Positions for the current spans and pane size, per target as needed.
    let built: {
      graph: Graph;
      step: number; // one onion layer, px at 100% zoom
      width: number;
      heights: SnakeHeights;
      placements: Map<string, SnakePlacement>;
    } | null = null;
    // What is on screen: the target the nodes are in (or heading to), and
    // the glide from wherever they were when the toggle came.
    let target: Target = ksnakesOf(slot);
    let glide: { from: Float32Array; start: number } | null = null;
    let placed = new Float32Array(0);
    // Opening, Fit all, a new dataset: fit it all once the layout exists.
    let wantFit = true;
    let scene: SnakeScene | null = null;

    const current = () => {
      const g = data.get().graph;
      return built && g && built.graph === g ? built : null;
    };

    const layout = () => {
      const g = data.get().graph;
      if (!g || !g.ksnakes) {
        built = null;
        return (scene = null);
      }
      if (structure?.graph !== g) {
        structure = { graph: g, st: snakeStructure(g.ksnakes) };
        target = ksnakesOf(slot);
        glide = null;
      }
      const { st } = structure;
      const { width: w, height: h } = canvasBox(stack);
      // The layers, the K gaps and the half gap beyond each outer span fill
      // the height; Spacing sets the width.
      const widthPct = ksnakesOf(slot).spacing;
      const layers = st.maxOnion - st.minOnion + K_GAP * (st.cores.length - 1) + 1 + K_GAP;
      const step = Math.max(1, h - 2 * PAD_Y) / layers;
      const width = (widthPct / 100) * Math.max(1, w - GUTTER.left - GUTTER.right - 2 * PAD_X);
      if (!current() || built!.width !== width || built!.step !== step) {
        const heights = snakeHeights(st, step, K_GAP * step);
        built = { graph: g, step, width, heights, placements: new Map() };
      }
      const to = placement()!;

      const progress = glide ? Math.min(1, (performance.now() - glide.start) / GLIDE_MS) : 1;
      if (placed.length !== 2 * st.n) placed = new Float32Array(2 * st.n);
      if (glide && progress < 1) lerpInto(placed, glide.from, to.xy, easeInOut(progress));
      else {
        glide = null;
        placed.set(to.xy);
      }
      const b = built!;

      // Centred at 100%, the pattern between the gutters, its outer K lines
      // and end bin lines (half a slot outside it) included.
      const { delimiters } = b.heights;
      const y0 = delimiters[0]!, y1 = delimiters.at(-1)!;
      const edge = to.spacing / 2;
      const bounds = { x0: -(GUTTER.left + PAD_X + edge), x1: width + edge + PAD_X + GUTTER.right, y0, y1 };
      view.fit(placed, st.n, w, h, 0, bounds, "none");
      if (wantFit) {
        // Zoomed out only as far as needed, so a width up to 100% stays at 100%.
        // The axis gutters stay pinned, so the width fits between them.
        wantFit = false;
        setView(slot, fitAll(y1 - y0, h - 2 * PAD_Y, width + 2 * (edge + PAD_X), w - GUTTER.left - GUTTER.right));
      }
      view.apply(viewOf(slot));
      refreshScene(w, h);
      if (glide) frame.schedule(full);
    };

    // The target's positions, placed once per width and pane size.
    const placement = () => {
      const b = current();
      if (!b || !structure) return null;
      const key = keyOf(target);
      let p = b.placements.get(key);
      if (!p) {
        const { st, graph } = structure;
        const order = st.orders[modeOf(target.group)][target.ordering];
        // Top-down places its rows under their neighbours; Size justifies them.
        const topdown = target.ordering === "topdown";
        const pull = topdown ? { source: graph.edgeSource, target: graph.edgeTarget } : null;
        p = snakeXY(st, graph.ksnakes!.onion, order, b.heights.onionY, b.width, !topdown, pull);
        b.placements.set(key, p);
      }
      return p;
    };

    // Sizes that follow the zoom. Tubes run through the members in the
    // target's x order, so mid-glide they follow the moving nodes. Pills
    // appear once the nodes have arrived; mid-glide their members are dots.
    let pillOf: (ScenePill | undefined)[] = [];
    const groups = new WeakMap<Uint32Array, number[]>();
    const refreshScene = (w: number, h: number) => {
      const b = current();
      const p = placement();
      if (!b || !p || !structure) return (scene = null);
      const { st } = structure;
      const order = st.orders[modeOf(target.group)][target.ordering];
      const k = view.pxPerUnit;
      const stepPx = b.step * k;
      const r = Math.max(1.2, Math.min(3.5, 0.4 * Math.min(p.spacing * k, stepPx)));
      // Widened where needed so a dot never touches its island's outline.
      const tube = Math.max(3, Math.min(24, 0.8 * stepPx), 2 * (r + NODE_CLEAR + HAIRLINE));
      // A pill is the same capsule as an island's tube.
      const hh = tube / 2;
      const pills: ScenePill[] = glide
        ? []
        : order.pills.map((pill) => {
            const v = pill.members[0]!;
            const hw = pillHalfWidth(hh, String(pill.members.length));
            return { members: pill.members, x: view.pos[2 * v]!, y: view.pos[2 * v + 1]!, hw, hh };
          });
      let inPill: Uint8Array | null = null;
      pillOf = [];
      if (pills.length) {
        inPill = new Uint8Array(st.n);
        pillOf = new Array(st.n);
        for (const pill of pills) for (const v of pill.members) (inPill[v] = 1), (pillOf[v] = pill);
      }
      scene = {
        view,
        st,
        heights: b.heights,
        islands: order.islands,
        pills,
        inPill,
        cuts: ksnakesOf(slot).gridlines ? p.cuts : null,
        tube,
        r,
        stepPx,
        w,
        h,
        gutter: GUTTER,
        source: b.graph.edgeSource,
        target: b.graph.edgeTarget,
      };
    };

    const paintBase = () => {
      const { ctx } = sizeCanvas(baseRef.current!);
      if (scene) drawBase(ctx, scene, readInk(stack));
    };

    const paintSets = () => {
      const { ctx } = sizeCanvas(setsRef.current!);
      if (!scene) return;
      const { nodes, edges } = shownSets();
      drawSets(ctx, scene, readInk(stack), nodes, edges);
    };

    const paintAxes = () => {
      const { ctx } = sizeCanvas(axesRef.current!);
      if (scene) drawAxes(ctx, scene, readInk(stack));
    };

    const paintHover = () => {
      const { ctx } = sizeCanvas(hoverRef.current!);
      if (scene) drawHover(ctx, scene, readInk(stack), hover.get().item);
    };

    const paintAll = () => {
      paintBase();
      paintSets();
      paintAxes();
      paintHover();
    };

    function full() {
      layout();
      paintAll();
      gesture.refreshHover();
    }

    const transformed = () => {
      if (!current() || glide) return full();
      view.apply(viewOf(slot));
      const { width, height } = canvasBox(stack);
      refreshScene(width, height);
      paintAll();
      gesture.refreshHover();
    };

    // The sweep runs down the onion heights, K gaps included: dense to sparse.
    // Sideways it runs across the target's positions, so it follows a glide
    // to where the nodes are going.
    const axis = (sideways: boolean) => {
      const b = current();
      if (!b) return null;
      if (!sideways) return sweepAxis(b.graph.ksnakes!.onion, b.heights);
      const p = placement();
      return p ? sweepAxisX(p, b.width) : null;
    };

    const ro = new ResizeObserver(() => frame.schedule(full));
    ro.observe(stack);
    const unsubs = [
      registerSweepAxis(slot, axis),
      data.subscribe((s, prev) => {
        if (s.graph !== prev.graph || (s.stages.basics.status === "done" && prev.stages.basics.status !== "done")) {
          frame.schedule(full);
        }
      }),
      ksnakesSettings.subscribe((s, prev) => {
        const now = ksnakesIn(s, slot);
        if (now === ksnakesIn(prev, slot)) return;
        // A new target glides from wherever the nodes are, mid-glide included.
        if (keyOf(now) !== keyOf(target) && structure?.graph === data.get().graph && placed.length) {
          glide = { from: placed.slice(), start: performance.now() };
        }
        target = now;
        frame.schedule(full);
      }),
      views.subscribe((s, prev) => s[slot] !== prev[slot] && frame.schedule(transformed)),
      fitRequests.subscribe((s, prev) => {
        if (s[slot] === prev[slot]) return;
        wantFit = true;
        frame.schedule(full);
      }),
      ui.subscribe((s, prev) => inkChanged(s, prev) && frame.schedule(full)),
      selection.subscribe(() => frame.schedule(paintSets)),
      sweep.subscribe(() => frame.schedule(paintSets)),
      hover.subscribe(() => frame.schedule(paintHover)),
    ];
    // A pill answers for all its members: the press lands on the capsule,
    // and hover and click take the whole pill.
    const nodes = pointHitTester(
      () => view.pos,
      () => view.n,
      () => scene?.r ?? 2,
    );
    const hit: HitTester = {
      ...nodes,
      itemAt(x, y) {
        for (const p of scene?.pills ?? []) {
          if (Math.abs(x - p.x) <= p.hw + 2 && Math.abs(y - p.y) <= p.hh + 2) return p.members[0]!;
        }
        return nodes.itemAt(x, y);
      },
      // The same array each time, so a still hover stays one hover.
      groupOf: (id) => {
        const members = pillOf[id]?.members;
        if (!members) return null;
        if (!groups.has(members)) groups.set(members, Array.from(members));
        return groups.get(members)!;
      },
    };
    const gesture = attachSelectGesture({
      el: stack,
      overlay: gestureRef.current!,
      type: "node",
      hit: () => (scene && current() ? hit : null),
    });
    const detachNav = attachNavigate(stack, slot);
    return () => {
      ro.disconnect();
      frame.cancel();
      unsubs.forEach((u) => u());
      gesture.detach();
      detachNav();
    };
  }, [slot]);

  const graph = useStore(data, (st) => st.graph);
  const fade = useFadeIn(graph, useStore(data, (st) => st.stages.basics.status === "done"));
  return (
    <>
      <div ref={stackRef} className={"pane-stack" + fade}>
        <canvas ref={baseRef} />
        <canvas ref={setsRef} />
        <canvas ref={axesRef} />
        <canvas ref={hoverRef} />
        <canvas ref={gestureRef} />
      </div>
      <WaitingOn stages={["basics"]} />
    </>
  );
}
