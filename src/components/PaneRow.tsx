import { Fragment, memo, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useStore } from "../state/createStore";
import { layout, setShares } from "../state/layout";
import type { SlotId } from "../state/layout";
import { PANES } from "../state/panes";
import type { PaneType } from "../state/panes";
import { Pane } from "./Pane";
import { NodeLinkPane } from "../panes/nodelink/NodeLinkPane";
import { LabelsPane } from "../panes/labels/LabelsPane";
import { MatrixPane } from "../panes/matrix/MatrixPane";
import { DatasetPane } from "../panes/DatasetPane";
import { HelpPane } from "../panes/dataset/HelpPane";
import { focus, ui } from "../state/uiStore";
import { KSnakesPane } from "../panes/ksnakes/KSnakesPane";
import { HopCensusPane } from "../panes/hopcensus/HopCensusPane";
import { PANE_MIN_PX, dragHandle, evenPair, sharesFromRatios, toShares } from "./paneWidths";
import { fitSlotToWidth, maxWidthsOf, rowPanes, widthsOf } from "./fitRow";
import { beginGesture, endGesture, gestureActive } from "../interaction/activeGesture";

const CONTENT: Record<PaneType, (slot: SlotId) => ReactNode> = {
  dataset: (slot) => <DatasetContent slot={slot} />,
  nodelink: (slot) => <NodeLinkPane slot={slot} />,
  labels: (slot) => <LabelsPane slot={slot} />,
  matrix: (slot) => <MatrixPane slot={slot} />,
  ksnakes: (slot) => <KSnakesPane slot={slot} />,
  hopcensus: (slot) => <HopCensusPane slot={slot} />,
};

// The Data slot shows its list, or Help in its place. The slot keeps its
// type, so its width and share never change. The list mounts afresh on return
// and reveals its ringed row, as on open.
function DatasetContent({ slot }: { slot: SlotId }) {
  const help = useStore(ui, (s) => s.help);
  return help ? <HelpPane /> : <DatasetPane slot={slot} />;
}

// Scroll the row so the focused pane sits at its centre (NodeLink when no
// pane is focused).
function centreFocused(row: HTMLElement) {
  const focused = ui.get().focused;
  const pane =
    (focused && row.querySelector<HTMLElement>(`.pane[data-slot="${focused}"]`)) ||
    row.querySelector<HTMLElement>('.pane[data-pane="nodelink"]');
  if (!pane) return;
  const p = pane.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  row.scrollLeft += p.left + p.width / 2 - (r.left + row.clientWidth / 2);
}

// In Scroll, the row's centre is a pointer held still while the panes slide
// under it: the pane it is over takes focus, and over a gap focus holds, as
// on hover. Unlike hover it hands on even while + New is ringed.
function focusAtCentre(row: HTMLElement) {
  const r = row.getBoundingClientRect();
  const mid = r.left + row.clientWidth / 2;
  for (const pane of row.querySelectorAll<HTMLElement>(".pane")) {
    const p = pane.getBoundingClientRect();
    if (p.left <= mid && mid < p.right) {
      if (pane.dataset.slot) focus(pane.dataset.slot);
      return;
    }
  }
}

// Run `fn` once per frame while the row scrolls.
function onScrollFrame(row: HTMLElement, fn: () => void) {
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fn();
    });
  };
  row.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    row.removeEventListener("scroll", onScroll);
  };
}

// The row of panes, one per slot. In Fit the panes share the window's width,
// with a handle in each gap. In Scroll they keep their ratios at the row's
// height, and the row scrolls natively (Shift + swipe anywhere, a plain
// sideways swipe off the canvases), snapping to each pane's centre, and the
// pane under the row's centre has focus, as under a still pointer.
export function PaneRow() {
  const rowRef = useRef<HTMLDivElement>(null);
  const slots = useStore(layout, (s) => s.slots);
  const fit = useStore(layout, (s) => s.mode === "fit");
  const saved = useStore(layout, (s) => s.shares);
  // Fit's opening proportions come from the default line-up, never from the
  // Scroll ratios.
  const shares = saved ? slots.map((x) => saved[x.slot]) : sharesFromRatios(PANES.map((p) => p.ar));

  // Fit opens with Labels at its narrowest, as its Minimum tile sets it: the
  // list reads at that width, and the room goes to the plots. Once shares
  // exist they are the user's, so this only runs the first time the row fits.
  useLayoutEffect(() => {
    const labels = slots.find((x) => x.type === "labels");
    if (fit && !layout.get().shares && labels) fitSlotToWidth(labels.slot, () => PANE_MIN_PX);
    if (!fit) centreFocused(rowRef.current!);
  }, [fit]);

  useLayoutEffect(() => {
    if (fit) return;
    const row = rowRef.current!;
    return onScrollFrame(row, () => focusAtCentre(row));
  }, [fit]);

  return (
    <div className="panes-shell">
      <div
        ref={rowRef}
        className={`panes${fit ? " is-fit" : ""}`}
        style={{ "--n": slots.length, "--pane-min": `${PANE_MIN_PX}px` } as CSSProperties}
      >
        {slots.map((x, i) => (
          <Fragment key={x.slot}>
            {fit && i > 0 && <PaneHandle index={i - 1} />}
            <Pane slot={x.slot} type={x.type} ar={x.ar} share={shares[i]}>
              {/* Keyed by type, so a new type mounts fresh content. */}
              <PaneContent key={x.type} slot={x.slot} type={x.type} />
            </Pane>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// Memoised, so a handle drag re-renders the banners, not the panes' content:
// each canvas redraws on its own when its size changes.
const PaneContent = memo(function PaneContent({ slot, type }: { slot: SlotId; type: PaneType }) {
  return <>{CONTENT[type](slot)}</>;
});

// The Fit row's gap between panes `index` and `index + 1`, as a handle.
//   drag          move the gap; past a pane's minimum, push the next one
//   double-click  even out the two panes
// A press here is outside every pane, so it focuses nothing.
function PaneHandle({ index }: { index: number }) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gestureActive()) return;
    e.preventDefault();
    const el = e.currentTarget;
    const id = e.pointerId;
    const panes = rowPanes();
    const w0 = widthsOf(panes);
    const max = maxWidthsOf(panes);
    const x0 = e.clientX;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId === id) setShares(toShares(dragHandle(w0, index, ev.clientX - x0, PANE_MIN_PX, max)));
    };
    const finish = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("lostpointercapture", up);
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
      setDragging(false);
    };
    const up = () => {
      finish();
      endGesture();
    };
    el.setPointerCapture(id);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("lostpointercapture", up);
    setDragging(true);
    beginGesture();
  };

  return (
    <div
      className={`pane-handle${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onDoubleClick={() => {
        const panes = rowPanes();
        setShares(toShares(evenPair(widthsOf(panes), index, maxWidthsOf(panes))));
      }}
    />
  );
}
