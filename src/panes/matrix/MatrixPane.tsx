import { useEffect, useRef } from "react";
import { data } from "../../data/dataStore";
import { useStore } from "../../state/createStore";
import { useFadeIn } from "../../components/fadeIn";
import { WaitingOn } from "../../components/PaneMessage";
import type { Graph } from "../../data/graph";
import { hover, selection } from "../../state/selection";
import { registerSweepAxis, shownSets, sweep } from "../../state/sweep";
import { inkChanged, ui } from "../../state/uiStore";
import { matrixIn, matrixOf, matrixSettings } from "../../state/matrix";
import type { SlotId } from "../../state/layout";
import type { Seriation } from "../../state/matrix";
import { viewOf, views } from "../../state/views";
import { canvasBox, sizeCanvas } from "../../canvas/sizeCanvas";
import { readInk } from "../../canvas/ink";
import { frameScheduler } from "../../canvas/frame";
import { PointView } from "../../canvas/pointView";
import { mapHits, pointHitTester } from "../../interaction/pointHits";
import { attachSelectGesture } from "../../interaction/selectGesture";
import { attachNavigate } from "../../interaction/navigate";
import { cellSize, edgePoints, rowsOf, formBounds, posed, poseAt, sweepAxis } from "./geometry";
import { easeInOut, GLIDE_MS, lerpInto } from "../../canvas/glide";
import type { MatrixPoints } from "./geometry";
import { drawBase, drawHover, drawSets } from "./render";
import { columnHits } from "./columnHits";
import type { MatrixScene } from "./render";

const PAD = 24; // px between the form and the pane edge, fitted

// The Matrix: node x node, each edge a point (so it hit-tests like
// the node panes), in the seriation and form picked in the bottom strip.
// A new seriation glides the points and node lines to their new cells, and a
// new form turns the matrix to it (both at once, if they overlap); a new
// dataset refits at once. It hovers and clicks edges; a shape takes the edges
// inside it, or in Nodes mode the columns it crosses. The same four canvases
// as NodeLink, each redrawn only when its own inputs change: base, sets,
// hover, gesture.
export function MatrixPane({ slot }: { slot: SlotId }) {
  const stackRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const setsRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stack = stackRef.current!;
    const view = new PointView();
    const frame = frameScheduler();

    // The points for the current graph and ordering, in the square; rebuilt
    // when either changes, never on zoom, pan or a new form.
    let built: { graph: Graph; seriation: Seriation; row: Uint32Array; points: MatrixPoints } | null = null;
    // What is on screen: the points' square positions and each node's row,
    // which trail `built` while a glide runs, and how far the matrix has
    // turned from the square to the diamond (0 to 1), which trails the form
    // while a turn runs. A new seriation or form mid-way starts from where
    // they are.
    let placed = new Float32Array(0);
    let placedRow = new Float32Array(0);
    let glide: { from: Float32Array; fromRow: Float32Array; start: number } | null = null;
    let share = 0;
    let turn: { from: number; to: number; start: number } | null = null;
    let shown = new Float32Array(0); // `placed` at the current pose
    let pose = 0;
    let scene: MatrixScene | null = null;

    const current = () => {
      const g = data.get().graph;
      const { seriation } = matrixOf(slot);
      return built && g && built.graph === g && built.seriation === seriation ? built : null;
    };
    // The order picked has landed (the engine fills it in while it runs).
    const ready = () => {
      const g = data.get().graph;
      return !!g && !!g.seriations[matrixOf(slot).seriation];
    };

    // Sizes that follow the zoom: row spacing on screen, and a point radius
    // that grows with it up to a cap.
    const refreshScene = () => {
      const b = current();
      if (!b) return (scene = null);
      const cellPx = view.pxPerUnit * cellSize(pose);
      const radius = Math.max(1.25, Math.min(4.5, 0.45 * cellPx));
      scene = { view, pose, n: b.graph.n, m: b.graph.m, row: placedRow, points: b.points, radius, cellPx };
    };

    const layout = () => {
      const g = data.get().graph;
      if (!g || !ready()) {
        built = null;
        scene = null;
        return;
      }
      const { seriation, form } = matrixOf(slot);
      const now = performance.now();
      const to = form === "diamond" ? 1 : 0;
      if (built?.graph !== g) {
        turn = null;
        share = to;
      } else if (to !== (turn ? turn.to : share)) turn = { from: share, to, start: now };
      if (!current()) {
        const reordered = built?.graph === g;
        glide = reordered ? { from: placed.slice(), fromRow: placedRow.slice(), start: now } : null;
        const row = rowsOf(g.seriations[seriation]!);
        built = { graph: g, seriation, row, points: edgePoints(row, g.edgeSource, g.edgeTarget) };
      }
      const b = built!;
      if (placed.length !== b.points.layout.length) placed = new Float32Array(b.points.layout.length);
      if (placedRow.length !== g.n) placedRow = new Float32Array(g.n);
      const progress = glide ? Math.min(1, (now - glide.start) / GLIDE_MS) : 1;
      if (glide && progress < 1) {
        const t = easeInOut(progress);
        lerpInto(placed, glide.from, b.points.layout, t);
        lerpInto(placedRow, glide.fromRow, b.row, t);
      } else {
        glide = null;
        placed.set(b.points.layout);
        placedRow.set(b.row);
      }
      const turned = turn ? Math.min(1, (now - turn.start) / GLIDE_MS) : 1;
      if (turn && turned < 1) share = turn.from + (turn.to - turn.from) * easeInOut(turned);
      else if (turn) {
        share = turn.to;
        turn = null;
      }
      pose = poseAt(share);
      if (shown.length !== placed.length) shown = new Float32Array(placed.length);
      posed(shown, placed, pose);
      const { width, height } = canvasBox(stack);
      // The square fits whole and the diamond fits the height, so a sweep
      // spans the pane; mid-turn the fit moves between the two. The fit is to
      // the form's extent, the same in every seriation, so a glide never
      // moves the view.
      view.fit(shown, b.points.count, width, height, PAD, formBounds(pose, g.n), share);
      view.apply(viewOf(slot));
      refreshScene();
      if (glide || turn) frame.schedule(full);
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

    const paintHover = () => {
      const { ctx } = sizeCanvas(hoverRef.current!);
      if (scene) drawHover(ctx, scene, readInk(stack), hover.get().item);
    };

    const paintAll = () => {
      paintBase();
      paintSets();
      paintHover();
    };

    const full = () => {
      layout();
      paintAll();
      gesture.refreshHover();
    };

    const transformed = () => {
      if (!current() || glide || turn) return full(); // new graph or ordering, or mid-glide or turn
      view.apply(viewOf(slot));
      refreshScene();
      paintAll();
      gesture.refreshHover();
    };

    // The sweep follows the seriation picked, even before a glide lands.
    const axis = (sideways: boolean) => {
      const g = data.get().graph;
      if (!g || !ready()) return null;
      const row = current()?.row ?? rowsOf(g.seriations[matrixOf(slot).seriation]!);
      return sweepAxis(row, g.edgeSource, g.edgeTarget, sideways);
    };

    const ro = new ResizeObserver(() => frame.schedule(full));
    ro.observe(stack);
    const unsubs = [
      registerSweepAxis(slot, axis),
      data.subscribe((s, prev) => (s.graph !== prev.graph || (!current() && s.revision !== prev.revision)) && frame.schedule(full)),
      matrixSettings.subscribe((s, prev) => matrixIn(s, slot) !== matrixIn(prev, slot) && frame.schedule(full)),
      views.subscribe((s, prev) => s[slot] !== prev[slot] && frame.schedule(transformed)),
      ui.subscribe((s, prev) => inkChanged(s, prev) && frame.schedule(full)),
      selection.subscribe(() => frame.schedule(paintSets)),
      sweep.subscribe(() => frame.schedule(paintSets)),
      hover.subscribe(() => frame.schedule(paintHover)),
    ];
    // Hits land on points; an edge drawn twice answers once. A Nodes-mode
    // shape takes the columns it crosses instead, in the order picked.
    const hit = {
      ...mapHits(
        pointHitTester(
          () => view.pos,
          () => view.n,
          () => scene?.radius ?? 2,
        ),
        () => built!.points.edgeOf,
      ),
      ...columnHits(() => built && { view, pose, order: built.graph.seriations[built.seriation]! }),
    };
    const gesture = attachSelectGesture({
      el: stack,
      overlay: gestureRef.current!,
      type: "edge",
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

  const seriation = useStore(matrixSettings, (s) => matrixIn(s, slot).seriation);
  const fade = useFadeIn(
    useStore(data, (st) => st.graph),
    useStore(data, (st) => !!st.graph?.seriations[seriation]),
  );
  return (
    <>
      <div ref={stackRef} className={"pane-stack" + fade}>
        <canvas ref={baseRef} />
        <canvas ref={setsRef} />
        <canvas ref={hoverRef} />
        <canvas ref={gestureRef} />
      </div>
      <MatrixWaiting slot={slot} />
    </>
  );
}

// The order picked is still being computed: its stage's progress, in place
// of the pattern.
function MatrixWaiting({ slot }: { slot: SlotId }) {
  const seriation = useStore(matrixSettings, (s) => matrixIn(s, slot).seriation);
  return <WaitingOn stages={[seriation.startsWith("pc") ? "components" : "harmonics"]} />;
}
