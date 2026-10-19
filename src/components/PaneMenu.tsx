import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { closeMenu, setHelp, ui } from "../state/uiStore";
import { DATASET_VIEWS, FIT_SHAPES, MAX_AR, SWAPPABLE } from "../state/panes";
import type { PaneType } from "../state/panes";
import { setSlotType } from "../state/layout";
import { useStore } from "../state/createStore";
import type { SlotId } from "../state/layout";
import { fitView } from "../state/views";
import { fitSlotToWidth } from "./fitRow";
import { PANE_MIN_PX } from "./paneWidths";
import { TEXT } from "../controlText";
import { scaled } from "../uiScale";

interface PaneMenuProps {
  slot: SlotId;
  type: PaneType;
  ar: number;
}

// How close a Fit pane's shape must be to a ratio, or its width to the
// minimum (px), for its tile to show as current.
const SHAPE_TOLERANCE = 0.02;
const MIN_TOLERANCE_PX = scaled(2);

// One tile: `ar` null is the Fit row's minimum width; `glyph` is the shape
// the tile draws.
interface Tile {
  ar: number | null;
  glyph: number;
  label: string;
}

// The header menu: a card floating inside the pane below its header, with one
// row per pane type (for Data, its list and Help), then the
// shape tiles. Neutral, the current type and
// shape tinted. Closes on a pick or a press anywhere else.
// In Scroll mode four tiles set the pane's ratio. In Fit mode three tiles
// (minimum, portrait golden, square) set the pane's width at its height, and
// the pane's current shape is the one tinted. Either way the pane refits, as
// Fit all does.
export function PaneMenu({ slot, type }: PaneMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const help = useStore(ui, (s) => s.help);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const pane = ref.current?.closest<HTMLElement>(".pane");
    setSize(pane ? { w: pane.offsetWidth, h: pane.offsetHeight } : null);
  }, []);

  // No shape wider than the pane may be (Data: minimum and portrait golden).
  const tiles = FIT_SHAPES.filter((t) => t.ar === null || t.ar <= (MAX_AR[type] ?? Infinity));
  const isCurrent = (t: Tile) => {
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

  return (
    <div ref={ref} className="pane-menu" role="menu" aria-label={TEXT.pane.menu}>
      {type === "dataset" ? (
        <div className="menu-types" role="group" aria-label={TEXT.pane.menuTypes}>
          {DATASET_VIEWS.map((v) => {
            const current = (v.id === "help") === help;
            return (
              <button
                key={v.id}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                className={`list-row is-menu${current ? " is-current" : ""}`}
                // Closes the menu too.
                onClick={() => setHelp(v.id === "help")}
              >
                <span className="list-text">{v.title}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="menu-types" role="group" aria-label={TEXT.pane.menuTypes}>
          {SWAPPABLE.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === type}
              className={`list-row is-menu${p.id === type ? " is-current" : ""}`}
              onClick={() => {
                setSlotType(slot, p.id);
                closeMenu();
              }}
            >
              <span className="list-text">{p.title}</span>
            </button>
          ))}
        </div>
      )}
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
            aria-checked={isCurrent(t)}
            className={`menu-ratio${isCurrent(t) ? " is-current" : ""}`}
            aria-label={t.label}
            onClick={() => {
              const tileAr = t.ar;
              fitSlotToWidth(slot, (h) => (tileAr === null ? PANE_MIN_PX : tileAr * h));
              fitView(slot);
              closeMenu();
            }}
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
