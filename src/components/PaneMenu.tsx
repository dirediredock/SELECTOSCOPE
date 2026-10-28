import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";
import { closeMenu, interfaceStore, setHelp } from "../state/interface";
import { DATA_VIEWS, FIT_SHAPES, MAX_AR, SCROLL_SHAPES, SWAPPABLE } from "../state/panes";
import type { PaneType } from "../state/panes";
import { paneRowStore, setSlotType } from "../state/paneRow";
import { useStore } from "../state/createStore";
import type { SlotId } from "../state/paneRow";
import { fitView } from "../state/paneViews";
import { setSlotShape } from "./fitRow";
import { PANE_MIN_PX } from "./paneWidths";
import { TEXT } from "../controlText";
import { scaled } from "../uiScale";

interface PaneMenuProps {
  slot: SlotId;
  type: PaneType;
  ar: number | null;
}

// How close a Fit pane's shape must be to a ratio, or its width to the
// minimum (px), for its tile to show as current.
const SHAPE_TOLERANCE = 0.02;
const MIN_TOLERANCE_PX = scaled(2);

// One tile: `ar` null is the row's minimum width; `glyph` is the shape the
// tile draws.
export interface Tile {
  ar: number | null;
  glyph: number;
  label: string;
}

// The header menu: a card floating inside the pane below its header, with one
// row per pane type (for Data, its list and Help), then the
// shape tiles. Neutral, the current type and
// shape tinted. Closes on a pick or a press anywhere else.
// Three tiles set the pane's shape: in Fit (minimum, portrait golden, square)
// its width at its height, in Scroll (minimum, tall 3:1, portrait golden) its
// ratio. The pane's current shape is
// the one tinted. Either way the pane refits, as Fit all does.
export function PaneMenu({ slot, type, ar }: PaneMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const help = useStore(interfaceStore, (s) => s.help);
  const fit = useStore(paneRowStore, (s) => s.mode === "fit");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const pane = ref.current?.closest<HTMLElement>(".pane");
    setSize(pane ? { w: pane.offsetWidth, h: pane.offsetHeight } : null);
  }, []);

  // No shape wider than the pane may be (Data: no Square).
  const tiles = (fit ? FIT_SHAPES : SCROLL_SHAPES).filter((t) => t.ar === null || t.ar <= (MAX_AR[type] ?? Infinity));
  const isCurrent = (t: Tile) => {
    if (!fit) return t.ar === null || ar === null ? t.ar === ar : Math.abs(ar / t.ar - 1) < SHAPE_TOLERANCE;
    if (!size) return false;
    if (t.ar === null) return Math.abs(size.w - PANE_MIN_PX) <= MIN_TOLERANCE_PX;
    return Math.abs(size.w / size.h / t.ar - 1) < SHAPE_TOLERANCE;
  };

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      // The header's own button toggles the menu; leave that press to it.
      if (ref.current?.contains(t) || t.closest(`[data-slot="${slot}"] .pane-header`)) return;
      // A press on this pane's content only closes the menu, so it never
      // starts a lasso or toggles a node under the card.
      if (t.closest(`[data-slot="${slot}"] .pane-body`)) e.stopPropagation();
      closeMenu();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [slot]);

  const rows =
    type === "data"
      ? DATA_VIEWS.map((v) => ({ id: v.id, title: v.title, current: (v.id === "help") === help }))
      : SWAPPABLE.map((p) => ({ id: p.id, title: p.title, current: p.id === type }));

  return (
    <PaneMenuView
      ref={ref}
      rows={rows}
      tiles={tiles.map((t) => ({ ...t, current: isCurrent(t) }))}
      onPickRow={(id) => {
        // Data's rows close the menu through setHelp.
        if (type === "data") setHelp(id === "help");
        else {
          setSlotType(slot, id as PaneType);
          closeMenu();
        }
      }}
      onPickTile={(t) => {
        setSlotShape(slot, t.ar);
        fitView(slot);
        closeMenu();
      }}
    />
  );
}

interface MenuRow {
  id: string;
  title: string;
  current: boolean;
}

// The card itself, with no state of its own, so Help can draw an inert copy
// of it.
export function PaneMenuView({
  ref,
  rows,
  tiles,
  onPickRow,
  onPickTile,
}: {
  ref?: Ref<HTMLDivElement>;
  rows: readonly MenuRow[];
  tiles: readonly (Tile & { current: boolean })[];
  onPickRow: (id: string) => void;
  onPickTile: (tile: Tile) => void;
}) {
  return (
    <div ref={ref} className="pane-menu" role="menu" aria-label={TEXT.pane.menu}>
      <div className="menu-types" role="group" aria-label={TEXT.pane.menuTypes}>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            role="menuitemradio"
            aria-checked={r.current}
            className={`list-row is-menu${r.current ? " is-current" : ""}`}
            onClick={() => onPickRow(r.id)}
          >
            <span className="list-text">{r.title}</span>
          </button>
        ))}
      </div>
      <div
        className="menu-ratios"
        role="group"
        aria-label={TEXT.pane.menuShapes}
        style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}
      >
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            role="menuitemradio"
            aria-checked={t.current}
            className={`menu-ratio${t.current ? " is-current" : ""}`}
            aria-label={t.label}
            onClick={() => onPickTile(t)}
          >
            <RatioGlyph ar={t.glyph} />
          </button>
        ))}
      </div>
    </div>
  );
}

// A rectangle in the ratio's shape. Its sides are given as fractions of the
// long side, which the stylesheet sizes to fit the tile.
function RatioGlyph({ ar }: { ar: number }) {
  const style = { "--gw": Math.min(ar, 1), "--gh": Math.min(1 / ar, 1) } as CSSProperties;
  return <span className="ratio-glyph" style={style} aria-hidden="true" />;
}
