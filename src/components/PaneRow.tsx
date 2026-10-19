import { Fragment, memo, useLayoutEffect, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useStore } from "../state/createStore";
import { layout, setShares } from "../state/layout";
import type { SlotId } from "../state/layout";
import type { PaneType } from "../state/panes";
import { Pane } from "./Pane";
import { NodeLinkPane } from "../panes/nodelink/NodeLinkPane";
import { LabelsPane } from "../panes/labels/LabelsPane";
import { MatrixPane } from "../panes/matrix/MatrixPane";
import { DatasetPane } from "../panes/DatasetPane";
import { HelpPane } from "../panes/dataset/HelpPane";
import { ui } from "../state/uiStore";
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

// The row of panes, one per slot, sharing the window's width, with a handle
// in each gap.
export function PaneRow() {
  const slots = useStore(layout, (s) => s.slots);
  const saved = useStore(layout, (s) => s.shares);
  const shares = saved ? slots.map((x) => saved[x.slot]) : sharesFromRatios(slots.map((x) => x.ar));

  // The row opens with Labels at its narrowest, as its Minimum tile sets it:
  // the list reads at that width, and the room goes to the plots.
  useLayoutEffect(() => {
    const labels = slots.find((x) => x.type === "labels");
    if (!saved && labels) fitSlotToWidth(labels.slot, () => PANE_MIN_PX);
    // On mount only: later shares are the user's.
  }, []);

  return (
    <div className="panes-shell">
      <div className="panes is-fit" style={{ "--n": slots.length, "--pane-min": `${PANE_MIN_PX}px` } as CSSProperties}>
        {slots.map((x, i) => (
          <Fragment key={x.slot}>
            {i > 0 && <PaneHandle index={i - 1} />}
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
