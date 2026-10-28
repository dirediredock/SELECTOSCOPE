import { CONTRAST, controlsStore, setContrast, setSelectMode, setTool, toggleTheme } from "../state/controls";
import {
  canGrow,
  canShrink,
  clearSet,
  growSelection,
  hopCount,
  selectionStore,
  sharePercent,
  shrinkSelection,
} from "../state/selection";
import { SELECT_MODES, TOOLS } from "../controlOptions";
import { useMemo } from "react";
import { useStore } from "../state/createStore";
import { Choice } from "./Choice";
import { ArrowStepper, Section, Slider, Switch, trayTip } from "./controls";
import { datasetStore } from "../data/datasetStore";
import { sweepRunStore } from "../state/sweep";
import { TEXT } from "../controlText";
import { scaled } from "../uiScale";

// The favicon's triangle (index.html draws it a little smaller and lower, to
// sit right in a browser tab), coloured from the theme tokens so it follows
// the app's Dark switch rather than the OS setting.
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <g className="logo-link" strokeWidth="3.5" strokeLinecap="round">
        <line x1="25.5" y1="16" x2="6.5" y2="5.5" />
        <line x1="25.5" y1="16" x2="6.5" y2="26.5" />
      </g>
      <line
        className="logo-sel-link"
        x1="6.5"
        y1="5.5"
        x2="6.5"
        y2="26.5"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle className="logo-sel-node" cx="25.5" cy="16" r="5" />
      <g className="logo-node">
        <circle cx="6.5" cy="5.5" r="5" />
        <circle cx="6.5" cy="26.5" r="5" />
      </g>
    </svg>
  );
}

// A set's size out of the graph's, over a share bar filled from the left in
// the set's colour (never under 2 px while it holds anything).
// It never fills on hover. The size is in the set's colour once it holds
// anything. Hovering the pill, or keyboard focus, swaps the percent for Clear,
// and a click anywhere on the pill clears the set: the only control that
// empties a set directly. While a sweep is active it counts the band, as the panes show
// it, and offers no Clear, since the set isn't what it shows. Each pill subscribes
// on its own, so the sweep's steps re-render the two pills alone.
function SetCount(props: { type: "node" | "edge"; total: number | null }) {
  const pick = <T,>(s: { nodes: ReadonlySet<T>; edges: ReadonlySet<T> }) =>
    (props.type === "node" ? s.nodes : s.edges).size;
  const sweeping = useStore(sweepRunStore, (s) => s.slot !== null);
  const banded = useStore(sweepRunStore, pick);
  const selected = useStore(selectionStore, pick);
  return (
    <SetCountView
      type={props.type}
      count={sweeping ? banded : selected}
      total={props.total}
      clearable={!sweeping}
      onClear={() => clearSet(props.type)}
    />
  );
}

// The pill alone, from its numbers: the strip's, or Help's example.
export function SetCountView(props: {
  type: "node" | "edge";
  count: number;
  total: number | null;
  clearable: boolean;
  onClear: () => void;
}) {
  const { count } = props;
  const noun = props.type === "node" ? "Nodes" : "Edges";
  const filled = count > 0;
  const share = props.total ? (100 * count) / props.total : 0;
  return (
    <div
      className={`set-count set-${props.type}`}
      role="group"
      aria-label={noun}
    >
      <span className="set-bar" aria-hidden="true">
        <span className="set-fill" style={{ width: filled ? `max(${scaled(2)}px, ${share}%)` : 0 }} />
      </span>
      <span className="set-readout control-text">
        <b className={`set-num${filled ? " is-filled" : ""}`}>{count}</b>
        {props.total !== null && (
          <>
            <span className="set-slash">/</span>
            <span className="set-total">{props.total}</span>
          </>
        )}
        <span className="set-noun">{noun}</span>
      </span>
      <span className="set-percent control-text">{sharePercent(count, props.total)}</span>
      {filled && props.clearable && (
        <button
          type="button"
          className="set-clear control-text"
          onClick={props.onClear}
        >
          Clear
        </button>
      )}
    </div>
  );
}

// Selection controls: which set(s) a shape writes, the two sets' sizes, how
// a shape is drawn, and a hop out or back. Every shape replaces the set(s) it
// writes. The last two rest while a sweep is active. At the right, the theme.
export function TopBar() {
  const tool = useStore(controlsStore, (s) => s.tool);
  const selectMode = useStore(controlsStore, (s) => s.selectMode);
  const graph = useStore(datasetStore, (s) => s.graph);
  const theme = useStore(controlsStore, (s) => s.theme);
  const contrast = useStore(controlsStore, (s) => s.contrast);
  // The Grow check is a pass over the edges, so it runs only when the sets,
  // the mode or the graph change.
  const sets = useStore(selectionStore, (s) => s);
  const grow = useMemo(() => canGrow(sets, selectMode), [sets, selectMode, graph]);
  const shrink = canShrink(sets);
  const hops = hopCount(sets);
  // While a sweep is active the panes show its band, not the sets, so the
  // Brush and Extend set trays fade whole, as idle Sweep controls do.
  const sweeping = useStore(sweepRunStore, (s) => s.slot !== null);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo />
        <h1 className="title">
          <a href="https://github.com/dirediredock/SELECTOSCOPE" target="_blank" rel="noopener noreferrer">
            Selectoscope
          </a>
        </h1>
      </div>

      <div className="topbar-center">
        <Section label="Selection set" tip={TEXT.top.selectSetTip} live>
          <Choice
            label="Selection set"
            options={SELECT_MODES}
            value={selectMode}
            onPick={setSelectMode}
          />
        </Section>
        <Section label="Selection count" tip={sweeping ? TEXT.top.countSweepTip : TEXT.top.countTip} live>
          <SetCount type="node" total={graph?.n ?? null} />
          <SetCount type="edge" total={graph?.m ?? null} />
        </Section>
        <Section label="Brush" tip={trayTip(TEXT.top.brushTip, sweeping && TEXT.top.sweepingTip)} idle={sweeping}>
          <div className="veil">
            <Choice label="Brush" options={TOOLS} value={tool} onPick={setTool} disabled={sweeping} />
          </div>
        </Section>
        <Section label="Extend set" tip={trayTip(TEXT.top.extendTip, sweeping && TEXT.top.sweepingTip)} idle={sweeping}>
          <div className="veil">
            <ArrowStepper
              label="Extend set"
              readout={hops > 0 ? `+${hops} ${hops === 1 ? "hop" : "hops"}` : "0 hops"}
              down={{ label: TEXT.top.shrink, onClick: shrinkSelection, disabled: !shrink }}
              up={{ label: TEXT.top.grow, onClick: () => growSelection(selectMode), disabled: !grow }}
              disabled={sweeping}
            />
          </div>
        </Section>
      </div>

      <div className="topbar-right">
        <Section label="Theme" tip={TEXT.top.themeTip}>
          <Slider label="Contrast" range={CONTRAST} value={contrast} onChange={setContrast} />
          <Switch label="Dark" on={theme === "dark"} onToggle={toggleTheme} />
        </Section>
      </div>
    </header>
  );
}
