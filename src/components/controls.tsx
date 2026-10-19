import { useId, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TEXT } from "../controlText";

// The strips' controls, one look per question the user asks. Choice, for
// "which one?", has its own file. A control's accessible name is its visible
// text, and its tooltip only describes it.

// One labelled group of controls, like the top strip's Selection set, on its own
// tray. The caps label names the group, so a bare "Run" or "Retry" is read in
// its context. A live tray is white: the Selection set, the Selection count
// and Auto Sweep. Every tray has a tip, covering the whole tray, and the
// controls inside have none (but a file pill's report). Why: one target per
// question, large enough to rest on.
export function Section(props: { label: string; tip: string; live?: boolean; idle?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <div
      className={`control${props.live ? " is-live" : ""}${props.idle ? " is-idle" : ""}`}
      role="group"
      aria-labelledby={id}
      data-tip={props.tip}
    >
      <span id={id} className="control-label">
        {props.label}
      </span>
      {props.children}
    </div>
  );
}

// A tray's tip: its lead, then the chosen option's hint, then why it is idle,
// leaving out what doesn't apply.
export const trayTip = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// On or off: a label, then a knob that slides across its track.
export function Switch(props: { label: string; on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      className="track switch control-text"
      onClick={props.onToggle}
      disabled={props.disabled}
    >
      {props.label}
      <span className="switch-track" aria-hidden="true">
        <span className="switch-knob" />
      </span>
    </button>
  );
}

// On or off with no word: Help's ?. The section nesting drawn as
// circles, a round tray holding a round track, so it reads as one of the
// family; on, a pressed-in slate thumb fills the track, as a Choice's does.
// A Switch's label would take the strip's spare column, and the ? reads
// without one.
export function HelpToggle(props: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="help-toggle">
      <button
        type="button"
        className="help-track"
        aria-label={props.label}
        aria-pressed={props.on}
        onClick={props.onToggle}
      >
        <span className="help-thumb" aria-hidden="true" />
        <span className="help-glyph" aria-hidden="true">
          ?
        </span>
      </button>
    </div>
  );
}

// Do it now: an outline with no fill, since it holds no state. The label is a
// verb and its object.
// A file to open at once (not kept, as a file pill's is): an Action whose
// click opens a picker for `accept`.
export function OpenFile(props: {
  children: ReactNode;
  accept: string;
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Action onClick={() => input.current?.click()} disabled={props.disabled}>
        {props.children}
      </Action>
      <input
        ref={input}
        type="file"
        accept={props.accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) props.onPick(f);
        }}
      />
    </>
  );
}

export function Action(props: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  // Pointer over it or keyboard focus on it, and back.
  onHover?: (on: boolean) => void;
}) {
  const hover = props.onHover;
  return (
    <button
      type="button"
      className={`action control-text${props.small ? " is-small" : ""}`}
      onClick={props.onClick}
      onPointerEnter={hover && (() => hover(true))}
      onPointerLeave={hover && (() => hover(false))}
      onFocus={hover && (() => hover(true))}
      onBlur={hover && (() => hover(false))}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}

// Glyphs drawn rather than typed: the font lacks them, and ▶ can come out as
// an emoji.

// Play and Stop stand at cap height, so they sit on the text's line and match
// each other optically. The stroke rounds the triangle's corners.
export const PlayGlyph = () => (
  <svg className="glyph" viewBox="0 0 9 10" aria-hidden="true" style={{ width: "0.64em", height: "0.71em", display: "block" }}>
    <path d="M1 1 8 5 1 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const DownGlyph = () => (
  <svg className="glyph" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M1.2 2 5 8.6 8.8 2Z" fill="currentColor" />
  </svg>
);

export const UpGlyph = () => (
  <svg className="glyph" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M1.2 8 5 1.4 8.8 8Z" fill="currentColor" />
  </svg>
);

const LeftGlyph = () => (
  <svg className="glyph" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M8 1.2 1.4 5 8 8.8Z" fill="currentColor" />
  </svg>
);

const RightGlyph = () => (
  <svg className="glyph" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M2 1.2 8.6 5 2 8.8Z" fill="currentColor" />
  </svg>
);

export const StopGlyph = () => (
  <svg className="glyph" viewBox="0 0 10 10" aria-hidden="true" style={{ width: "0.71em", height: "0.71em", display: "block" }}>
    <rect x="1.2" y="1.2" width="7.6" height="7.6" rx="1.2" fill="currentColor" />
  </svg>
);

// Start or stop: a raised button while idle, pressed-in slate while its process runs. The
// label says what the next click does (Run, Stop, Resume; Add; Stop); the
// labels share one cell, so the width never jumps.
export interface TransportCell {
  id: string;
  content: ReactNode;
}

export function Transport(props: {
  cells: readonly TransportCell[];
  state: string;
  running: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`action transport control-text${props.running ? " is-running" : ""}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.cells.map((c) => (
        <span key={c.id} className={props.state === c.id ? undefined : "is-hidden"} aria-hidden={props.state !== c.id}>
          {c.content}
        </span>
      ))}
    </button>
  );
}

// Auto Sweep's Run, Stop and Resume, by sweep state.
export const RUN_CELLS: readonly TransportCell[] = [
  { id: "idle", content: <><PlayGlyph /> Run</> },
  { id: "running", content: <><StopGlyph /> Stop</> },
  { id: "paused", content: <><PlayGlyph /> Resume</> },
];

// How much: a share (%) by default, or another `unit`. The name and readout
// sit in the track; the input is named by the name alone and reads its value
// with the unit. Focus leaves on release, so Space reaches the app again; the
// arrow keys still step it while it has focus (but for ↑ and ↓ while a sweep
// takes them). Disabled, it dims and keeps its place.
export function Slider(props: {
  label: string;
  range: { min: number; max: number };
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  readout?: string; // replaces the value and unit, for a rail that isn't the value
  disabled?: boolean;
}) {
  const readout = props.readout ?? `${props.value} ${props.unit ?? "%"}`;
  return (
    <label className={`track slider-field${props.disabled ? " is-disabled" : ""}`}>
      <span className="control-text" aria-hidden="true">
        {props.label}
      </span>
      <input
        type="range"
        className="slider"
        min={props.range.min}
        max={props.range.max}
        step={1}
        value={props.value}
        // The rail fills to the value (styles.css `.slider`).
        style={{ "--p": `${((props.value - props.range.min) / (props.range.max - props.range.min)) * 100}%` } as CSSProperties}
        aria-label={props.label}
        aria-valuetext={readout}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        onPointerUp={(e) => e.currentTarget.blur()}
      />
      <span className="control-text slider-readout" aria-hidden="true">
        {readout}
      </span>
    </label>
  );
}

// How far along: a slider's track with no knob, named by what is happening and
// filled by the share done, with its percent. With no share known, a segment
// glides along it and there is no percent. `reserve` holds every name it may
// show, so the track keeps one width as the name changes.
export function Progress(props: { label: string; share: number | null; reserve?: readonly string[] }) {
  const labelId = useId();
  const known = props.share !== null;
  const percent = Math.round((props.share ?? 0) * 100);
  return (
    <span className="track progress-field">
      <span id={labelId} className="control-text progress-label">
        <span>{props.label}</span>
        {props.reserve?.map((r) => (
          <span key={r} className="is-hidden" aria-hidden="true">
            {r}
          </span>
        ))}
      </span>
      <span
        className={`progress${known ? "" : " is-indeterminate"}`}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={known ? 0 : undefined}
        aria-valuemax={known ? 100 : undefined}
        aria-valuenow={known ? percent : undefined}
        style={known ? ({ "--p": `${percent}%` } as CSSProperties) : undefined}
      >
        <span className="progress-fill" />
      </span>
      {known && (
        <span className="control-text slider-readout" aria-hidden="true">
          {percent} %
        </span>
      )}
    </span>
  );
}

// A file to add, then remove or replace. Missing, an Action reading
// "+ <name>" that opens a file picker (CSV unless `accept` says otherwise): the key file filled white, an extra
// one faint. Added, the name alone; hovering it, or keyboard focus, swaps
// the name for Remove (or, with `replace`, Replace, which opens the picker
// again), and a click anywhere on the pill does it (the Selection count's
// Clear). The name and its hover word share one cell, so the width never
// jumps. Refused, it takes the refusal hue and a dot before its name.
// `report`: the file's report for its tip (report.ts reportTip, as JSON).
export function FilePill(props: {
  name: string;
  added: boolean;
  accent: "key" | "extra";
  onPick: (file: File) => void;
  onRemove?: () => void;
  replace?: boolean;
  refused?: boolean;
  title?: string;
  report?: string | null;
  disabled?: boolean;
  accept?: string;
  // Another pill's name, which this one is as wide as, so trays that swap
  // one for the other keep their width.
  sizeAs?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const accent =
    (props.accent === "key" ? " is-key" : props.added ? "" : " is-missing") + (props.added && props.refused ? " is-refused" : "");
  const word = props.replace ? "Replace" : "Remove";
  const picker = (
    <input
      ref={input}
      type="file"
      accept={props.accept ?? ".csv,text/csv"}
      hidden
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Cleared, so picking the same file again still counts.
        e.target.value = "";
        if (file) props.onPick(file);
      }}
    />
  );
  if (props.added) {
    return (
      <div className={`action file-pill control-text${accent}`} role="group" aria-label={props.name}>
        <span className="file-word">
          {props.refused && <AlertDot />}
          {props.name}
        </span>
        <span className="file-sizer" aria-hidden="true">
          {word}
        </span>
        {props.sizeAs && (
          <span className="file-sizer" aria-hidden="true">
            {props.sizeAs}
          </span>
        )}
        <button
          type="button"
          className="file-remove control-text"
          onClick={props.replace ? () => input.current?.click() : props.onRemove}
          data-tip={props.title}
          data-tip-report={props.report ?? undefined}
          disabled={props.disabled}
        >
          {word}
        </button>
        {props.replace && picker}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        className={`action file-pill control-text${accent}${props.sizeAs ? " is-sized" : ""}`}
        onClick={() => input.current?.click()}
        data-tip={props.title}
        data-tip-report={props.report ?? undefined}
        disabled={props.disabled}
      >
        {props.sizeAs ? (
          <>
            <span className="file-word">+ {props.name}</span>
            <span className="file-sizer" aria-hidden="true">
              + {props.sizeAs}
            </span>
          </>
        ) : (
          <>+ {props.name}</>
        )}
      </button>
      {picker}
    </>
  );
}

// Something stopped this loading: a file refused, a stage failed, a build
// file unread. The one mark in the refusal hue, beside words that say what.
export function AlertDot() {
  return <span className="alert-dot" role="img" aria-label={TEXT.dataset.alert} />;
}

// More or less: − and + about a readout. A click on the readout does its own
// thing (Zoom fits all).
export function Stepper(props: {
  label: string;
  readout: string;
  onLess: () => void;
  onMore: () => void;
  onReadout: () => void;
  lessLabel: string;
  moreLabel: string;
}) {
  return (
    <div className="track stepper" role="group" aria-label={props.label}>
      <button type="button" className="stepper-step" onClick={props.onLess} aria-label={props.lessLabel}>
        −
      </button>
      <button
        type="button"
        className="stepper-readout control-text"
        onClick={props.onReadout}
      >
        {props.readout}
      </button>
      <button type="button" className="stepper-step" onClick={props.onMore} aria-label={props.moreLabel}>
        +
      </button>
    </div>
  );
}

// One step a click: ▼ and ▲ about a plain readout with no click (Extend set's
// hops). Each arrow dims on its own when a press would change nothing.
// Disabled whole, both arrows stop and each keeps its own look under a veil.
export interface Step {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ArrowStepper(props: { label: string; readout: string; down: Step; up: Step; disabled?: boolean }) {
  const step = (s: Step, glyph: ReactNode) => (
    <button
      type="button"
      className={`stepper-step${s.disabled ? " is-dim" : ""}`}
      onClick={s.onClick}
      aria-label={s.label}
      disabled={props.disabled || s.disabled}
    >
      {glyph}
    </button>
  );
  return (
    <div className={`track stepper${props.disabled ? " is-disabled" : ""}`} role="group" aria-label={props.label}>
      {step(props.down, <DownGlyph />)}
      <span className="stepper-word stepper-count control-text" aria-live="polite">
        {props.readout}
      </span>
      {step(props.up, <UpGlyph />)}
    </div>
  );
}

// Step and hold: ▲ and ▼ about a plain word, back before it and forward after
// it, as ◀ and ▶ sideways. A press steps once, and holding
// it keeps stepping, as a held arrow key does. Focus leaves on release, so the
// arrow keys reach the app again. Disabled, it dims and keeps its place.
export function HoldStepper(props: {
  label: string;
  word: string;
  forwardLabel: string;
  backLabel: string;
  onPress: (dir: 1 | -1) => void;
  onRelease: (dir: 1 | -1) => void;
  held?: -1 | 0 | 1; // the arrow held down, by pointer or key, drawn pressed
  disabled?: boolean;
  sideways?: boolean; // ◀ back and ▶ forward, rather than ▲ back and ▼ forward
}) {
  const step = (dir: 1 | -1, name: string, glyph: ReactNode) => (
    <button
      type="button"
      className={`stepper-step${props.held === dir ? " is-pressed" : ""}`}
      aria-label={name}
      disabled={props.disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        props.onPress(dir);
      }}
      onPointerUp={(e) => {
        props.onRelease(dir);
        e.currentTarget.blur();
      }}
      onPointerCancel={() => props.onRelease(dir)}
      onLostPointerCapture={() => props.onRelease(dir)}
      // A keyboard press (Enter or Space) clicks with no pointer: one step.
      onClick={(e) => {
        if (e.detail !== 0) return;
        props.onPress(dir);
        props.onRelease(dir);
      }}
    >
      {glyph}
    </button>
  );
  return (
    <div
      className={`track stepper hold-stepper${props.disabled ? " is-disabled" : ""}`}
      role="group"
      aria-label={props.label}
    >
      {step(-1, props.backLabel, props.sideways ? <LeftGlyph /> : <UpGlyph />)}
      <span className="stepper-word control-text">{props.word}</span>
      {step(1, props.forwardLabel, props.sideways ? <RightGlyph /> : <DownGlyph />)}
    </div>
  );
}
