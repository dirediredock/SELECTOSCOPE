import { useEffect, useRef } from "react";
import { useStore } from "../../state/createStore";
import { datasetStore } from "../../state/dataset";
import type { Graph } from "../../data/graph";
import { hoverStore } from "../../state/hover";
import { selectionStore } from "../../state/selection";
import { registerSweepAxis, shownSets, sweepRunStore } from "../../state/sweepRun";
import { controlsStore, inkChanged } from "../../state/controls";
import { fitRequestsStore } from "../../state/fitRequests";
import { viewOf, paneViewsStore } from "../../state/paneViews";
import {
  isSpatial,
  layoutMissing,
  layoutPositions,
  nodelinkIn,
  nodelinkOf,
  nodelinkPaneStore,
  rotateView,
  shownView,
} from "../../state/nodelinkPane";
import type { SlotId } from "../../state/paneRow";
import type { NodeLinkView } from "../../state/nodelinkPane";
import { canvasBox, sizeCanvas } from "../../canvas/sizeCanvas";
import { readInk } from "../../canvas/ink";
import { frameScheduler } from "../../canvas/frame";
import { boundsOf, PointView } from "../../canvas/pointView";
import type { Bounds } from "../../canvas/pointView";
import { edgeAt, pointHitTester, withEdgePicks } from "../../interaction/pointHits";
import { attachSelectGesture } from "../../interaction/selectGesture";
import { attachNavigate } from "../../interaction/navigate";
import { nodeRadius, sweepAxis } from "./view";
import { project } from "./rotation";
import { startLive } from "./live";
import type { LiveSim } from "./live";
import { attachNodeDrag } from "./nodeDrag";
import { drawHover, drawScene } from "./render";
import { useFadeIn } from "../../components/fadeIn";
import { PaneAction, PaneMessage, WaitingOn } from "../../components/PaneMessage";
import { MissingFilePill } from "../../components/UserFilePill";
import { computeFd3d } from "../../engine/engine";
import { TEXT } from "../../controlText";

// Layouts are normalized to the unit sphere, so the 3D view fits this disc:
// turning the layout never changes its scale.
const UNIT: Bounds = { x0: -1, x1: 1, y0: -1, y1: 1 };

// Three stacked canvases, each redrawn only when its own inputs change:
//   scene     every mark, far to near (data, size, theme, zoom/pan, rotation,
//             either set or a sweep step, a live tick)
//   hover     the hovered item (pointer rate, so it costs one mark)
//   gesture   the lasso / rectangle outline
// Its views (bottom strip): a 3D layout (3D or Bespoke 3D), turned by dragging
// (navigate.ts); 2D positions (2D or Bespoke 2D); and the live force
// simulation, started from the layout as it was on screen, whose nodes can be
// dragged (nodeDrag.ts). A layout the dataset lacks draws nothing, and a
// message takes its place. Shapes select the nodes inside them, the edges those
// nodes share, or both (the top strip's Select mode); hover and click also
// reach edge lines, in every mode.
export function NodeLinkPane({ slot }: { slot: SlotId }) {
  const stackRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stack = stackRef.current!;
    const view = new PointView();
    const frame = frameScheduler();
    let radius = 3;

    // What is on screen: the graph and view it was placed for, the
    // screen-plane positions (layout units) and, in 3D, each node's depth.
    let shown: { graph: Graph; view: NodeLinkView; xy: Float32Array; depth: Float32Array | null } | null = null;
    let live: { graph: Graph; run: number; sim: LiveSim } | null = null;
    // The computed layouts last drawn (each frame is a new array), so a stage
    // landing elsewhere redraws nothing.
    let drawnFd: Float32Array | null = null;
    let drawnFd3d: Float32Array | null = null;

    const stopLive = () => {
      live?.sim.stop();
      live = null;
    };

    // The running simulation for this graph and run, started if missing.
    const ensureLive = (g: Graph) => {
      const { liveRun, layout, rotation } = nodelinkOf(slot);
      if (live && live.graph === g && live.run === liveRun) return live.sim;
      stopLive();
      // From 3D, the turned layout as it was last seen. Interactive is only switched
      // on over a layout the dataset has; FD stands in should one go missing.
      let start = (layoutPositions(g, layout) ?? g.layoutFd)!;
      if (isSpatial(layout) && start.length === 3 * g.n) {
        const turned = new Float32Array(2 * g.n);
        project(rotation, start, g.n, turned, new Float32Array(g.n));
        start = turned;
      }
      live = { graph: g, run: liveRun, sim: startLive(g, start, () => frame.schedule(full)) };
      return live.sim;
    };

    // Positions for the current view, and the extent the view fits to; null
    // for a layout the dataset lacks, which draws nothing.
    const place = (g: Graph): Bounds | null => {
      const picked = shownView(nodelinkOf(slot));
      // Interactive starts from FD once it has settled; until then the pane
      // shows FD's frames as they land, which is the same run at rest.
      const fdSettling = datasetStore.get().stages.fd2d.status !== "done";
      const mode = picked === "live" && fdSettling ? "fd" : picked;
      if (mode !== "live") stopLive();
      if (mode !== "live") {
        const pos = layoutPositions(g, mode);
        if (!pos) {
          shown = null;
          return null;
        }
        if (isSpatial(mode)) {
          const reuse = shown?.graph === g && shown.view === mode;
          const xy = reuse ? shown!.xy : new Float32Array(2 * g.n);
          const depth = reuse ? shown!.depth! : new Float32Array(g.n);
          project(nodelinkOf(slot).rotation, pos, g.n, xy, depth);
          shown = { graph: g, view: mode, xy, depth };
          return UNIT;
        }
        shown = { graph: g, view: picked, xy: pos, depth: null };
        return boundsOf(pos, g.n);
      }
      const sim = ensureLive(g);
      shown = { graph: g, view: mode, xy: sim.xy, depth: null };
      return sim.bounds;
    };

    const current = () => {
      const g = datasetStore.get().graph;
      return g && shown?.graph === g && shown.view === shownView(nodelinkOf(slot)) ? shown : null;
    };

    const layout = () => {
      const g = datasetStore.get().graph;
      if (!g) return;
      const bounds = place(g);
      if (!bounds) return;
      const { width, height } = canvasBox(stack);
      view.fit(shown!.xy, g.n, width, height, 20, bounds);
      view.apply(viewOf(slot));
      radius = nodeRadius(g.n);
    };

    const paintScene = () => {
      const { ctx } = sizeCanvas(sceneRef.current!);
      const s = current();
      if (!s) return;
      const { nodes, edges } = shownSets();
      drawScene(ctx, {
        g: s.graph,
        pos: view.pos,
        r: radius,
        ink: readInk(stack),
        nodes,
        edges,
        depth: s.depth,
      });
    };

    const paintHover = () => {
      const { ctx } = sizeCanvas(hoverRef.current!);
      const s = current();
      if (s) drawHover(ctx, s.graph, view.pos, radius, readInk(stack), hoverStore.get().item);
    };

    const full = () => {
      layout();
      paintScene();
      paintHover();
      gesture.refreshHover();
    };

    const transformed = () => {
      if (!current()) return full(); // a new graph or view: place it first
      view.apply(viewOf(slot));
      paintScene();
      paintHover();
      gesture.refreshHover();
    };

    // Read each step, so the sweep follows rotation, a live tick or a new view.
    const axis = (sideways: boolean) => {
      const s = current();
      return s ? sweepAxis(s.xy, s.depth !== null, s.graph.n, sideways) : null;
    };

    const ro = new ResizeObserver(() => frame.schedule(full));
    ro.observe(stack);
    const unsubs = [
      registerSweepAxis(slot, axis),
      // A new dataset opens fitted: state/fitRequests.ts resets every pane's view.
      datasetStore.subscribe((s, prev) => {
        if (s.graph !== prev.graph) frame.schedule(full);
        // A layout frame, or FD settling (Interactive then takes over).
        else if (
          s.graph &&
          (s.graph.layoutFd !== drawnFd || s.graph.layoutFd3d !== drawnFd3d || s.stages.fd2d.status !== prev.stages.fd2d.status)
        ) {
          drawnFd = s.graph.layoutFd;
          drawnFd3d = s.graph.layoutFd3d;
          frame.schedule(full);
        }
      }),
      paneViewsStore.subscribe((s, prev) => s[slot] !== prev[slot] && frame.schedule(transformed)),
      nodelinkPaneStore.subscribe((next, before) => {
        const s = nodelinkIn(next, slot), prev = nodelinkIn(before, slot);
        if (shownView(s) !== shownView(prev) || s.rotation !== prev.rotation || s.liveRun !== prev.liveRun) {
          frame.schedule(full);
        }
      }),
      controlsStore.subscribe((s, prev) => inkChanged(s, prev) && frame.schedule(full)),
      // Fit all in the Interactive view fits the positions now, not everywhere they've been.
      fitRequestsStore.subscribe((s, prev) => {
        if (s[slot] === prev[slot] || !live) return;
        live.sim.fitToCurrent();
        frame.schedule(full);
      }),
      selectionStore.subscribe(() => frame.schedule(paintScene)),
      sweepRunStore.subscribe(() => frame.schedule(paintScene)),
      hoverStore.subscribe(() => frame.schedule(paintHover)),
    ];
    const hit = withEdgePicks(
      pointHitTester(
        () => view.pos,
        () => view.n,
        () => radius,
        () => current()?.depth ?? null,
      ),
      (x, y) => {
        const s = current();
        return s ? edgeAt(x, y, view.pos, s.graph.edgeSource, s.graph.edgeTarget, s.graph.m, s.depth) : null;
      },
    );
    const detachDrag = attachNodeDrag({
      el: stack,
      view,
      hit: () => (current() ? hit : null),
      sim: () => (current()?.view === "live" ? (live?.sim ?? null) : null),
    });
    const gesture = attachSelectGesture({
      el: stack,
      overlay: gestureRef.current!,
      type: "node",
      hit: () => (current() ? hit : null),
    });
    const detachNav = attachNavigate(stack, slot, {
      active: () => isSpatial(shownView(nodelinkOf(slot))),
      by: (dx, dy) => rotateView(slot, dx, dy),
    });
    return () => {
      ro.disconnect();
      frame.cancel();
      stopLive();
      unsubs.forEach((u) => u());
      detachDrag();
      gesture.detach();
      detachNav();
    };
  }, [slot]);

  const g = useStore(datasetStore, (s) => s.graph);
  const s = useStore(nodelinkPaneStore, (st) => nodelinkIn(st, slot));
  // FD (and Interactive, which starts from it) waits on its stages; an own
  // layout the dataset lacks is a message.
  const computed = s.live || s.layout === "fd";
  const hasFd = useStore(datasetStore, (st) => !!st.graph?.layoutFd);
  const hasFd3d = useStore(datasetStore, (st) => !!st.graph?.layoutFd3d);
  const fd3dOff = useStore(datasetStore, (st) => st.stages.fd3d.status === "off");
  const wants3d = !s.live && s.layout === "fd3d" && !!g && !hasFd3d;
  // FD's frames draw once the harmonics seed it, so they fade in then.
  const seeded = useStore(datasetStore, (st) => st.stages.harmonics.status === "done");
  const fade = useFadeIn(g, !!g && (computed ? seeded || hasFd : s.layout === "fd3d" ? hasFd3d : !layoutMissing(g, s)));
  return (
    <div ref={stackRef} className={"pane-stack" + fade}>
      <canvas ref={sceneRef} />
      <canvas ref={hoverRef} />
      <canvas ref={gestureRef} />
      {computed && g && !hasFd && <WaitingOn stages={["harmonics", "fd2d"]} />}
      {wants3d && (fd3dOff ? <PaneAction text={TEXT.nodelink.missing.fd3d} onClick={computeFd3d} /> : <WaitingOn stages={["fd3d"]} />)}
      {!computed && s.layout !== "fd3d" && layoutMissing(g, s) && (
        <PaneMessage text={TEXT.nodelink.missing[s.layout]}>
          <MissingFilePill kind={s.layout === "own3d" ? "layout3d" : "layout2d"} />
        </PaneMessage>
      )}
    </div>
  );
}
