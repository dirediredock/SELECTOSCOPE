import { useRef } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { focus, toggleHelp, toggleMenu, ui } from "../state/uiStore";
import { useStore } from "../state/createStore";
import { fitView, viewIn, views, zoomLabel } from "../state/views";
import { bandStart, sweep, sweepSettings, toggleSweepWrap } from "../state/sweep";
import { MAX_AR, paneInfo, slotTitle } from "../state/panes";
import type { PaneType } from "../state/panes";
import type { SlotId } from "../state/layout";
import { PaneMenu } from "./PaneMenu";
import { usePaneSubtitle } from "./paneSubtitle";
import { PlayGlyph, trayTip } from "./controls";
import { TEXT } from "../controlText";

// The header's tip waits this long, twice a tray's. Why: a header is crossed
// on every way between the panes and the top strip, and passing isn't asking.
const HEADER_REST_MS = 2000;

interface PaneProps {
  slot: SlotId;
  type: PaneType;
  // Its Scroll ratio; null is the row's minimum width.
  ar: number | null;
  // Its share of the row in Fit mode (styles.css `.panes.is-fit`).
  share: number;
  children: ReactNode;
}

// One pane in its banner: an outer frame holding the header band,
// the content in an inner rounded frame, and the footer band. The banner is
// plain, or gray when focused: its controls fill the bottom strip (faintly
// gray while the pointer crosses it on the way there). Beside the
// title, a subtitle says what the strip has chosen (paneSubtitle.ts). While
// this pane's sweep is active, the footer holds the sweep strip; Data's, which
// never sweeps, stays empty, kept so every pane has the same frame.
//   pointer enters it            focus this pane (hoverFocus.ts: not while a
//                                button is held, nor on the way to the strip)
//   any press                    focus this pane
//   keyboard focus within it     focus this pane
//   click on the header          toggle the type and shape menu (Data: its
//                                list or Help, and its shape)
//   click on the zoom percent    fit all (canvas panes only)
//   click on the ?               show or hide Help (Data only)
export function Pane({ slot, type, ar, share, children }: PaneProps) {
  const { list } = paneInfo(type);
  const title = useStore(ui, (s) => slotTitle(type, s.help));
  const isFocused = useStore(ui, (s) => s.focused === slot);
  const isPassed = useStore(ui, (s) => s.passed === slot);
  const menuOpen = useStore(ui, (s) => s.menuOpen === slot);
  // A drag selects; with Space held, it navigates.
  const grab = useStore(ui, (s) => s.spaceHeld);
  const sweeping = useStore(sweep, (s) => (s.slot !== slot ? "off" : s.paused ? "paused" : "running"));
  const subtitle = usePaneSubtitle(slot, type);

  return (
    <section
      className={`pane${isFocused ? " is-focused" : ""}${isPassed ? " is-passed" : ""}${grab ? " is-grab" : ""}`}
      data-pane={type}
      data-slot={slot}
      data-list={list || undefined}
      data-narrow={ar === null || undefined}
      aria-label={title}
      style={{ "--ar": ar ?? undefined, "--share": share, "--max-ar": MAX_AR[type] } as CSSProperties}
      // Capture, so a press focuses even where a gesture stops propagation.
      onPointerDownCapture={() => focus(slot)}
      onFocusCapture={() => focus(slot)}
    >
      <div
        className="pane-header"
        onClick={() => toggleMenu(slot)}
        // A tray of its own, hidden while its menu is open.
        data-tip={menuOpen ? undefined : trayTip(TEXT.pane.menuTip, !list && TEXT.pane.fitTip, type === "dataset" && TEXT.pane.helpTip)}
        data-tip-side="above"
        data-tip-rest={HEADER_REST_MS}
        data-tip-no-handoff=""
        data-tip-wide=""
      >
        {sweeping !== "off" && <SweepMark running={sweeping === "running"} />}
        <div className="pane-heading">
          <button
            type="button"
            className="pane-title"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {title}
          </button>
          {subtitle && <span className="pane-subtitle">{subtitle}</span>}
        </div>
        {!list && <ZoomPercent slot={slot} />}
        {type === "dataset" && <HelpButton />}
      </div>
      <div className="pane-body">
        {children}
        {menuOpen && <PaneMenu slot={slot} type={type} ar={ar} />}
      </div>
      <div className="pane-footer">{type !== "dataset" && <SweepStrip slot={slot} />}</div>
    </section>
  );
}

// This pane's sweep is active, running or paused: a play glyph before the
// title, so the pane that drives the band shows wherever the strip is. An
// indicator only: it pulses while the sweep runs and holds still when paused.
function SweepMark({ running }: { running: boolean }) {
  return (
    <span className={`pane-sweep${running ? " is-running" : ""}`} role="img" aria-label={TEXT.pane.sweepRunning}>
      <PlayGlyph />
    </span>
  );
}

// This pane's sweep is active: the band as a segment Area % of the rail wide,
// left to right whichever way it travels, running off the ends or wrapping
// round them as the band does. It steps when the panes relight, so it never
// shows a place they don't. The bottom strip follows the pointer, so this
// keeps the pane that drives the band in view. It fades out holding its last
// place. The play glyph names the state; a click anywhere on the footer band
// switches Wrap, while the sweep is active.
function SweepStrip({ slot }: { slot: SlotId }) {
  const step = useStore(sweep, (s) => (s.slot === slot ? s.step : null));
  const area = useStore(sweepSettings, (s) => s.area);
  const wrap = useStore(sweepSettings, (s) => s.wrap);
  const last = useRef(0);
  if (step !== null) last.current = step;
  const w = area / 100;
  const t = bandStart(last.current, w, wrap);
  const pct = (x: number) => `${x * 100}%`;
  // The rail clips what lies past its ends.
  return (
    <button
      type="button"
      className="pane-sweep-hit"
      aria-label={TEXT.sweep.wrap}
      aria-pressed={wrap}
      disabled={step === null}
      onClick={toggleSweepWrap}
    >
      <span className={`pane-sweep-strip${step !== null ? " is-active" : ""}`}>
        <span className="pane-sweep-band" style={{ left: pct(t), width: pct(w) }} />
        {wrap && t + w > 1 && <span className="pane-sweep-band" style={{ left: 0, width: pct(t + w - 1) }} />}
      </span>
    </button>
  );
}

// The pane's zoom, and its Fit all. The click stops here, so it never opens
// the menu.
function ZoomPercent({ slot }: { slot: SlotId }) {
  const k = useStore(views, (s) => viewIn(s, slot).k);
  return (
    <button
      type="button"
      className="pane-zoom"
      onClick={(e) => {
        e.stopPropagation();
        fitView(slot);
      }}
    >
      {zoomLabel(k)}
    </button>
  );
}

// The ? stops its click here, as the zoom percent does, so it never opens the
// menu.
export function onHelpClick(e: Pick<MouseEvent, "stopPropagation">) {
  e.stopPropagation();
  toggleHelp();
}

// The Data header's ?, where a canvas pane shows its zoom percent: shows or
// hides Help in this slot. A hairline circle, filled while it shows.
export function HelpButton() {
  const on = useStore(ui, (s) => s.help);
  return (
    <button
      type="button"
      className="pane-help"
      aria-label={TEXT.help.name}
      aria-pressed={on}
      onClick={onHelpClick}
    >
      <span className="pane-help-glyph" aria-hidden="true">
        ?
      </span>
    </button>
  );
}
