import { useEffect, useRef } from "react";
import { datasetStore } from "../../state/dataset";
import { landedCensus } from "../../data/graph";
import type { Graph, HopCensus } from "../../data/graph";
import { useStore } from "../../state/createStore";
import { useFadeIn } from "../../components/fadeIn";
import { WaitingOn } from "../../components/PaneMessage";
import { hoverStore } from "../../state/hover";
import { selectionStore } from "../../state/selection";
import { registerSweepAxis, shownSets, sweepRunStore } from "../../state/sweepRun";
import { controlsStore, inkChanged } from "../../state/controls";
import { hopsIn, hopsOf, hopsPaneStore } from "../../state/hopsPane";
import type { CensusMeasure } from "../../state/hopsPane";
import type { SlotId } from "../../state/paneRow";
import { viewOf, paneViewsStore } from "../../state/paneViews";
import { canvasBox, sizeCanvas } from "../../canvas/sizeCanvas";
import { readInk } from "../../canvas/ink";
import { frameScheduler } from "../../canvas/frame";
import { easeInOut, GLIDE_MS, lerpInto } from "../../canvas/glide";
import { PointView } from "../../canvas/pointView";
import { attachSelectGesture } from "../../interaction/selectGesture";
import { attachNavigate } from "../../interaction/navigate";
import { censusOrder, censusStructure, censusXY, sweepAxis } from "./geometry";
import type { CensusOrder, CensusPlacement, CensusStructure } from "./geometry";
import { polylineHitTester } from "./hits";
import { drawAxes, drawBase, drawHover, drawSets } from "./render";
import type { CensusScene } from "./render";

const GUTTER = 36; // px at the right for the E labels
const PAD_X = 14; // px between the pattern and the gutter
// The fit keeps the pattern between a small buffer at the left edge and the
// gutter, centred there, so the E labels never sit over the lines.
const INSETS = { left: 20, right: GUTTER + PAD_X, top: 20, bottom: 20 };

// Hops: one polyline per node through its stub census, binned by
// eccentricity, the smallest on top, each bin a square. At 100% zoom the
// whole pattern fits the pane, lines slid by Spacing included, as the
// matrix does, and it refits on every resize. A new shape order glides the
// lines sideways to their new places, eased as Shells' and the matrix's
// glides are, and the view holds still; a new dataset changes at once. It
// draws nodes only: the node set, or a sweep's nodes while one runs. Five canvases, each redrawn only when its inputs change:
// base, sets, axes, hover, gesture.
export function HopsPane({ slot }: { slot: SlotId }) {
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

    let structure: { graph: Graph; census: HopCensus; st: CensusStructure } | null = null;
    // The shape order for the current measure, shared by the lines and the sweep.
    let ordered: { graph: Graph; st: CensusStructure; measure: CensusMeasure; rank: boolean; order: CensusOrder } | null = null;
    // What is on screen: each line's place along the order, which trails the
    // order's while a glide runs. A new order mid-glide starts from where the
    // lines are.
    let shown = new Float32Array(0);
    let glide: { graph: Graph; from: Float32Array; start: number } | null = null;
    // Vertices for the current order and Spacing, squares of side 1. None
    // while a glide runs, when they change every frame.
    let built: { order: CensusOrder; slide: number; placement: CensusPlacement } | null = null;
    let scene: CensusScene | null = null;

    const orderOf = (g: Graph, st: CensusStructure) => {
      const { measure, rank } = hopsOf(slot);
      const o = ordered;
      if (o?.graph === g && o.st === st && o.measure === measure && o.rank === rank) return o.order;
      ordered = { graph: g, st, measure, rank, order: censusOrder(st, measure, rank) };
      return ordered.order;
    };

    const layout = () => {
      const g = datasetStore.get().graph;
      if (!g) return (scene = null);
      const hc = landedCensus(g);
      if (!hc) {
        built = null;
        return (scene = null);
      }
      if (structure?.graph !== g || structure.census !== hc.census) {
        structure = { graph: g, census: hc.census, st: censusStructure(hc.census, hc.present) };
        built = null;
      }
      const { width: w, height: h } = canvasBox(stack);
      const { slide } = hopsOf(slot);
      const order = orderOf(g, structure.st);
      if (glide?.graph !== g) glide = null;
      if (shown.length !== g.n) shown = new Float32Array(g.n);
      const progress = glide ? Math.min(1, (performance.now() - glide.start) / GLIDE_MS) : 1;
      if (glide && progress < 1) lerpInto(shown, glide.from, order.place, easeInOut(progress));
      else {
        glide = null;
        shown.set(order.place);
      }
      const look = { slide, place: shown };
      const b = built;
      if (glide) built = null;
      else if (!b || b.order !== order || b.slide !== slide) {
        built = { order, slide, placement: censusXY(structure.st, hc.census, 1, look) };
      }
      const p = built?.placement ?? censusXY(structure.st, hc.census, 1, look);
      // Room for any line to slide the full Spacing, whatever the order, so
      // the whole pattern always shows and a new order moves the lines
      // sideways, never the view.
      const bounds = { x0: 0, x1: 1 + slide, y0: 0, y1: p.height };
      view.fit(p.xy, p.xy.length / 2, w, h, INSETS, bounds);
      view.apply(viewOf(slot));
      scene = { view, placement: p, offset: hc.census.offset, n: g.n, w, h, gutter: GUTTER };
      if (glide) frame.schedule(full);
    };

    const paintBase = () => {
      const { ctx } = sizeCanvas(baseRef.current!);
      if (scene) drawBase(ctx, scene, readInk(stack));
    };

    // Like every pane, it shows only the sweep while one runs, so an edge
    // sweep leaves it without blue.
    const paintSets = () => {
      const { ctx } = sizeCanvas(setsRef.current!);
      if (scene) drawSets(ctx, scene, readInk(stack), shownSets().nodes);
    };

    const paintAxes = () => {
      const { ctx } = sizeCanvas(axesRef.current!);
      if (scene) drawAxes(ctx, scene, readInk(stack));
    };

    const paintHover = () => {
      const { ctx } = sizeCanvas(hoverRef.current!);
      if (scene) drawHover(ctx, scene, readInk(stack), hoverStore.get().item);
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
      if (!scene || glide) return full();
      view.apply(viewOf(slot));
      paintAll();
      gesture.refreshHover();
    };

    // The sweep follows the order picked, even before a glide lands.
    const axis = (sideways: boolean, wrap: boolean) => {
      const g = datasetStore.get().graph;
      if (!g || !structure || structure.graph !== g) return null;
      return sweepAxis(structure.st, orderOf(g, structure.st), sideways, wrap);
    };

    const ro = new ResizeObserver(() => frame.schedule(full));
    ro.observe(stack);
    const unsubs = [
      registerSweepAxis(slot, axis),
      datasetStore.subscribe((s, prev) => {
        // A new graph, or more lines landed.
        if (s.graph !== prev.graph || (s.graph && landedCensus(s.graph)?.census !== structure?.census)) frame.schedule(full);
      }),
      hopsPaneStore.subscribe((s, prev) => {
        const now = hopsIn(s, slot), was = hopsIn(prev, slot);
        if (now === was) return;
        // A new order glides the lines from wherever they are, mid-glide
        // included; a dataset switch, which resets the settings before its
        // layout, never does.
        const g = datasetStore.get().graph;
        const reordered = now.measure !== was.measure || now.rank !== was.rank;
        if (g && reordered && structure?.graph === g && shown.length === g.n) {
          glide = { graph: g, from: shown.slice(), start: performance.now() };
        }
        frame.schedule(full);
      }),
      paneViewsStore.subscribe((s, prev) => s[slot] !== prev[slot] && frame.schedule(transformed)),
      controlsStore.subscribe((s, prev) => inkChanged(s, prev) && frame.schedule(full)),
      selectionStore.subscribe((s, prev) => s.nodes !== prev.nodes && frame.schedule(paintSets)),
      sweepRunStore.subscribe((s, prev) => s.nodes !== prev.nodes && frame.schedule(paintSets)),
      hoverStore.subscribe(() => frame.schedule(paintHover)),
    ];
    const hit = polylineHitTester(
      () => view.pos,
      () => scene!.offset,
    );
    const gesture = attachSelectGesture({
      el: stack,
      overlay: gestureRef.current!,
      type: "node",
      hit: () => (scene ? hit : null),
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

  // Lines draw as their chunks land; until the first does, the stage's
  // progress shows in their place.
  const none = useStore(datasetStore, (st) => !!st.graph && !st.graph.hopRows?.done && !st.graph.hopCensus);
  const fade = useFadeIn(useStore(datasetStore, (st) => st.graph), !none);
  return (
    <>
      <div ref={stackRef} className={"pane-stack" + fade}>
        <canvas ref={baseRef} />
        <canvas ref={setsRef} />
        <canvas ref={axesRef} />
        <canvas ref={hoverRef} />
        <canvas ref={gestureRef} />
      </div>
      {none && <WaitingOn stages={["hops"]} />}
    </>
  );
}
