import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { data } from "../../data/dataStore";
import { useStore } from "../../state/createStore";
import { hover, hoveredNodes, selection } from "../../state/selection";
import { registerSweepAxis, shownIn, sweep } from "../../state/sweep";
import { labelSortIn, labelSortOf, labelsMissing, labelsSettings } from "../../state/labels";
import type { SlotId } from "../../state/layout";
import { LIST_ROWS, VirtualList } from "../../components/VirtualList";
import { labelOrder, sameOrder, sortRank, sortValue } from "./order";
import type { SortKeys } from "./order";
import type { Graph } from "../../data/graph";
import type { LabelSort } from "../../state/labels";
import { attachListGesture } from "./listGesture";
import type { ListGesture } from "./listGesture";
import { useFadeIn } from "../../components/fadeIn";
import { PaneMessage, WaitingOn } from "../../components/PaneMessage";
import { MissingFilePill } from "../../components/UserFilePill";
import { TEXT } from "../../controlText";

const EMPTY: Uint32Array = new Uint32Array(0);

// Onion reads the Shells stage's results, Eigenvector the Centrality stage's.
const sortReady = (g: Graph, sort: LabelSort) =>
  sort === "onion" ? !!g.cores : sort === "eigenvector" ? !!g.centrality : true;
const NONE = new Uint32Array(0);
const sortKeys = (g: Graph): SortKeys => ({
  labels: g.labels,
  degree: g.degree,
  onion: g.cores?.onion ?? NONE,
  eigenvector: g.centrality?.eigenvector ?? NONE,
});

// One row per node, as a pill row: node_id + 1 (zero-padded) | the sort's value
// (none under Labels (A–Z)) | label | edge dot. Narrow, the number hides first,
// so the value and the label keep the room (a container query in styles.css).
//   blue tint   in the node set        red ring   the hovered node
//   orange dot  endpoint of an edge in the edge set
//   red dot     endpoint of the hovered edge (Labels has no edge marks of its
//               own, so it shows edges on their endpoints)
// A running sweep replaces both sets on screen (its nodes tinted, its edges'
// endpoints dotted); the order still follows the node set, so rows stay put
// while it runs. This pane's own sweep walks the rows top to bottom; the list
// stays where the user put it.
// Order: selected rows first, each group by the strip's Sort. Frozen while
// the pointer is over the list, so nothing moves under the cursor; re-sorted
// when it leaves, live while it is elsewhere, and at once on a new Sort,
// which is deliberate. A re-sort that changes the order scrolls to the top.
// Labels are italic. Labels (A–Z) with no labels shows a message in place of
// the rows.
export function LabelsPane({ slot }: { slot: SlotId }) {
  const graph = useStore(data, (s) => s.graph);
  const { nodes, edges } = shownIn(
    useStore(selection, (s) => s),
    useStore(sweep, (s) => s),
  );
  const sort = useStore(labelsSettings, (s) => labelSortIn(s, slot));
  const [order, setOrder] = useState(EMPTY);
  // Onion and Eigenvector arrive with the Shells stage; until then those sorts
  // wait, and Degree and Labels (A–Z) work at once.
  const keysReady = useStore(data, (s) => !!s.graph && sortReady(s.graph, sort));
  const fade = useFadeIn(graph, keysReady && !labelsMissing(graph, sort));
  const value = useMemo(() => graph && keysReady && sortValue(sort, sortKeys(graph)), [graph, sort, keysReady]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef(EMPTY);
  const gestureRef = useRef<ListGesture | null>(null);
  // Whether the pointer is over the list, which freezes the order.
  const overRef = useRef(false);

  const endpoints = useMemo(() => {
    const out = new Uint8Array(graph?.n ?? 0);
    if (graph) {
      for (const e of edges) {
        out[graph.edgeSource[e]!] = 1;
        out[graph.edgeTarget[e]!] = 1;
      }
    }
    return out;
  }, [graph, edges]);

  useEffect(() => {
    const scroller = scrollerRef.current!;

    // No rows while the message shows, so nothing to hover, band or sweep.
    const resort = (force: boolean) => {
      const g = data.get().graph;
      const sort = labelSortOf(slot);
      const rank = g && !labelsMissing(g, sort) && sortReady(g, sort) && sortRank(sort, sortKeys(g));
      const next = rank ? labelOrder(rank, selection.get().nodes) : EMPTY;
      if (!force && sameOrder(orderRef.current, next)) return;
      orderRef.current = next;
      setOrder(next);
      scroller.scrollTop = 0;
    };

    // The sweep walks the rows in their shown order.
    const axis = () => {
      const order = orderRef.current;
      const nodes = new Float64Array(order.length);
      order.forEach((v, i) => (nodes[v] = i / order.length));
      return { nodes };
    };

    // Hover changes at pointer rate, so it skips React: toggle the classes on
    // the rows in view. Newly mounted rows read hover.get() as they render.
    const paintHover = () => {
      scroller
        .querySelectorAll(".is-hover, .is-edge-hover")
        .forEach((r) => r.classList.remove("is-hover", "is-edge-hover"));
      const item = hover.get().item;
      const g = data.get().graph;
      if (!item || !g) return;
      const mark = (id: number, cls: string) => scroller.querySelector(`[data-node="${id}"]`)?.classList.add(cls);
      if (item.type === "node") hoveredNodes(item).forEach((v) => mark(v, "is-hover"));
      else {
        mark(g.edgeSource[item.id]!, "is-edge-hover");
        mark(g.edgeTarget[item.id]!, "is-edge-hover");
      }
    };

    const unsubs = [
      data.subscribe((s, prev) => {
        if (s.graph !== prev.graph) resort(true);
        else if (
          (s.stages.basics.status === "done" && prev.stages.basics.status !== "done") ||
          (s.stages.centrality.status === "done" && prev.stages.centrality.status !== "done")
        ) {
          resort(true);
        }
      }),
      selection.subscribe((s, prev) => {
        if (s.nodes !== prev.nodes && !overRef.current) resort(false);
      }),
      labelsSettings.subscribe((s, prev) => {
        if (s.bySlot[slot] !== prev.bySlot[slot]) resort(false);
      }),
      hover.subscribe(paintHover),
      registerSweepAxis(slot, axis),
    ];
    resort(true);

    const onEnter = () => (overRef.current = true);
    const onLeave = () => {
      overRef.current = false;
      resort(false);
    };
    scroller.addEventListener("pointerenter", onEnter);
    scroller.addEventListener("pointerleave", onLeave);

    const gesture = attachListGesture({
      el: scroller,
      band: bandRef.current!,
      geometry: LIST_ROWS,
      order: () => orderRef.current,
    });
    gestureRef.current = gesture;
    return () => {
      unsubs.forEach((u) => u());
      scroller.removeEventListener("pointerenter", onEnter);
      scroller.removeEventListener("pointerleave", onLeave);
      gesture.detach();
      gestureRef.current = null;
    };
  }, [slot]);

  // Rows moved under a still cursor: hover whatever is there now.
  useLayoutEffect(() => gestureRef.current?.refreshHover(), [order]);

  const h = hover.get().item;
  const hoverSet = new Set(hoveredNodes(h));
  // Zero-padded to the width of the largest number, so the column reads evenly.
  const digits = String(graph?.n ?? 0).length;
  return (
    <>
      <VirtualList
        rowCount={order.length}
        geometry={LIST_ROWS}
        scrollerRef={scrollerRef}
        rowKey={(i) => order[i]!}
        className={(value ? "labels-list has-value" : "labels-list") + fade}
        onScroll={() => gestureRef.current?.refreshHover()}
        renderRow={(i) => {
          const id = order[i]!;
          if (!graph || id >= graph.n) return null;
          const hovered = hoverSet.has(id);
          const edgeHovered = h?.type === "edge" && (graph.edgeSource[h.id] === id || graph.edgeTarget[h.id] === id);
          const cls =
            "list-row" +
            (nodes.has(id) ? " is-selected" : "") +
            (endpoints[id] ? " is-endpoint" : "") +
            (hovered ? " is-hover" : "") +
            (edgeHovered ? " is-edge-hover" : "");
          return (
            <div className={cls} data-node={id}>
              <span className="list-num">{String(id + 1).padStart(digits, "0")}</span>
              {value && <span className="list-value">{value(id)}</span>}
              <span className="list-text">{graph.labels[id]}</span>
              <span className="list-dot" />
            </div>
          );
        }}
      >
        <div ref={bandRef} className="list-band" />
      </VirtualList>
      {labelsMissing(graph, sort) && (
        <PaneMessage text={TEXT.labels.missing}><MissingFilePill kind="labels" /></PaneMessage>
      )}
      {graph && !keysReady && <WaitingOn stages={sort === "onion" ? ["basics"] : ["centrality"]} />}
    </>
  );
}
