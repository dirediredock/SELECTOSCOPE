import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { scaled } from "../uiScale";
import type { TipBlock } from "./report";

// The one tooltip. A tray (the pane header and the strip's ? are trays)
// carries its text in `data-tip`; this layer, mounted once, shows it after
// the pointer rests on
// it, and at once on keyboard focus: under it, but over it in the bottom
// strip, so a tip always opens toward the pane row; a Data row's opens beside
// it (`data-tip-side="right"`). Every tip is an outlined
// talk bubble whose pointer marks its anchor. While shown it describes its
// anchor (`aria-describedby`), and its text follows the anchor's, so a choice
// or a state change inside a tray reads at once. A file pill's only tip is its
// report (`data-tip-report`, report.ts reportTip's blocks as JSON), once there
// is one.
// Why one layer: a native `title` can't follow the theme
// and never shows on focus.

export const DELAY_MS = 1000;
// A tip that hid as the pointer left hands off: the next control reached
// within this long shows its tip at once.
// Why: gliding along a strip reading tips shouldn't wait a second per control.
export const HANDOFF_MS = 500;
// Design px between the control and the bubble, about 22px on screen: the
// pointer's 12 plus 10 of air between its tip and the control.
const GAP = 24;
const MARGIN = 8; // design px kept from the window's edge
// Design px (1.85rem) the pointer's centre keeps from each end of the bubble:
// its half width plus the corner's radius, so it never sits on a curve.
const POINTER_INSET = 22.2;

export interface TipPlace {
  left: number;
  top: number;
  side: "below" | "above" | "right" | "left"; // where the bubble sits, so the pointer faces the control
  // The pointer's centre along the edge facing the control: from the bubble's
  // left edge below or above it, from its top edge to its right or left.
  pointer: number;
}

// Centred on the anchor, clamped inside the window, on the side `prefer`
// names, or the other when there is no room there (unless `keep`: then above
// stays above, held inside the window). The pointer stays on the anchor's
// centre as far as the bubble's ends allow.
export function placeTip(
  anchor: DOMRect,
  tip: { width: number; height: number },
  win: { width: number; height: number },
  prefer: "below" | "above" = "below",
  keep = false,
): TipPlace {
  const gap = scaled(GAP);
  const margin = scaled(MARGIN);
  const inset = scaled(POINTER_INSET);
  const centre = anchor.left + anchor.width / 2;
  const left = Math.min(Math.max(centre - tip.width / 2, margin), Math.max(margin, win.width - tip.width - margin));
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - tip.height;
  const fitsBelow = below + tip.height + margin <= win.height;
  const fitsAbove = above >= margin;
  const side = keep ? prefer : prefer === "above" ? (fitsAbove || !fitsBelow ? "above" : "below") : fitsBelow ? "below" : "above";
  const top = side === "below" ? below : Math.max(margin, above);
  const pointer = tip.width < 2 * inset ? tip.width / 2 : Math.min(Math.max(centre - left, inset), tip.width - inset);
  return { left, top, side, pointer };
}

// Beside the anchor: to its right, or its left when there is no room there,
// centred on its middle and clamped inside the window. The pointer stays on
// the anchor's middle as far as the bubble's ends allow. Why: a Data row's
// tip is long, and below the row it would cover the rows under it.
export function placeTipBeside(anchor: DOMRect, tip: { width: number; height: number }, win: { width: number; height: number }): TipPlace {
  const gap = scaled(GAP);
  const margin = scaled(MARGIN);
  const inset = scaled(POINTER_INSET);
  const right = anchor.right + gap;
  const leftOf = anchor.left - gap - tip.width;
  const side = right + tip.width + margin <= win.width || leftOf < margin ? "right" : "left";
  const left = Math.max(margin, Math.min(side === "right" ? right : leftOf, win.width - tip.width - margin));
  const middle = anchor.top + anchor.height / 2;
  const top = Math.min(Math.max(middle - tip.height / 2, margin), Math.max(margin, win.height - tip.height - margin));
  const pointer = tip.height < 2 * inset ? tip.height / 2 : Math.min(Math.max(middle - top, inset), tip.height - inset);
  return { left, top, side, pointer };
}

// Help writes other controls' names in caps (NODES, EXTEND SET); a tip sets
// them as small caps so they read as names, not shouting. Odd parts are caps.
const CAPS = /\b([A-Z][A-Z0-9]+(?:\s[A-Z][A-Z0-9]+)*)\b/g;
export const tipParts = (text: string) => text.split(CAPS);

const tipOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>("[data-tip], [data-tip-report]") : null;

const hasTip = (el: HTMLElement) => !!(el.dataset.tip || el.dataset.tipReport);

// When a tip shows and hides, as plain DOM listeners on `doc`, so tests can
// drive it without React. `onChange` gets the anchor to show, or null to hide;
// it gets the shown anchor again when its tip's text changes. `current` is
// the anchor under the pointer (or focused) whether its tip is waiting, shown
// or dismissed. A press hides the tip and its release shows it again at once,
// reading what the click changed; Esc, a scroll, a wheel or a blur keep it
// hidden until the pointer leaves that anchor. Why: a tray's tip follows its
// choice, so a click is worth reading, where a scroll or Esc means "not now".
export function watchTips(doc: Document, onChange: (el: HTMLElement | null) => void): () => void {
  const win = doc.defaultView ?? window;
  let timer = 0;
  let handOff = 0; // the timer while a hand-off is open, else 0
  let current: HTMLElement | null = null;
  let shown = false;
  let pressed = false; // a press inside `current` hid its tip, for the release to undo
  // The shown anchor's tip, read again as it changes.
  const watch = new win.MutationObserver(() => {
    if (!shown || !current) return;
    if (hasTip(current)) onChange(current);
    else dismiss();
  });

  const setShown = (el: HTMLElement | null) => {
    shown = el !== null;
    watch.disconnect();
    if (el) watch.observe(el, { attributes: true, attributeFilter: ["data-tip", "data-tip-report"] });
    onChange(el);
  };
  const show = (el: HTMLElement) => {
    if (el !== current || !el.isConnected || !hasTip(el)) return;
    setShown(el);
  };
  // Hide and keep `current`: a press, Esc, a scroll, a wheel, a blur.
  const dismiss = () => {
    win.clearTimeout(timer);
    pressed = false;
    if (shown) setShown(null);
  };
  // The pointer has left `current`. Only a tip that was showing opens a hand-off.
  const leave = () => {
    win.clearTimeout(timer);
    pressed = false;
    if (shown) {
      setShown(null);
      win.clearTimeout(handOff);
      handOff = win.setTimeout(() => (handOff = 0), HANDOFF_MS);
    }
    current = null;
  };
  const press = (e: PointerEvent) => {
    dismiss();
    pressed = !!current && e.target instanceof Node && current.contains(e.target);
  };
  // Only where the pointer still is over the anchor: a captured drag (a
  // slider, Arrow) releases on its control wherever the pointer went.
  const release = (e: PointerEvent) => {
    if (!pressed || !current) return;
    pressed = false;
    const at = doc.elementFromPoint?.(e.clientX, e.clientY) ?? e.target;
    if (at instanceof Node && current.contains(at)) show(current);
  };

  const over = (e: PointerEvent) => {
    const el = tipOf(e.target);
    if (el === current) return;
    leave();
    // A held button is a drag, not a rest.
    if (!el || e.buttons !== 0) return;
    current = el;
    // An anchor may ask for a longer rest (`data-tip-rest`, ms) and to wait
    // it out even in a hand-off (`data-tip-no-handoff`): a pane header.
    if (handOff && el.dataset.tipNoHandoff === undefined) show(el);
    else timer = win.setTimeout(() => show(el), Number(el.dataset.tipRest) || DELAY_MS);
  };
  // pointerover alone misses leaving onto nothing (out of the window, or onto
  // a gap with no tip), so a waiting timer would fire after the pointer left.
  const out = (e: PointerEvent) => {
    if (!current) return;
    const to = e.relatedTarget;
    if (to instanceof Node && current.contains(to)) return;
    leave();
  };
  const focus = (e: FocusEvent) => {
    // Only keyboard focus shows; a pointer press has already dismissed. The
    // focused control may sit inside the area that carries the tip (a pane header).
    if (!(e.target instanceof Element) || !e.target.matches(":focus-visible")) return;
    const el = tipOf(e.target);
    if (!el) return;
    // Focus moving between a tray's controls keeps its tip.
    if (el === current && shown) return;
    if (el !== current) leave();
    current = el;
    show(el);
  };
  const blur = (e: FocusEvent) => {
    const to = e.relatedTarget;
    if (to instanceof Node && current?.contains(to)) return;
    if (current && e.target instanceof Node && current.contains(e.target)) dismiss();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") dismiss();
  };
  // Only a scroll that moves the anchor away from its tip. Why: a list gliding
  // elsewhere (the Data list, as Add dataset's + New is hovered) leaves the
  // control where it was.
  const scroll = (e: Event) => {
    if (current && (e.target === doc || (e.target instanceof Node && e.target.contains(current)))) dismiss();
  };
  const away = () => leave();

  doc.addEventListener("pointerover", over);
  doc.addEventListener("pointerout", out);
  doc.addEventListener("pointerdown", press, true);
  doc.addEventListener("pointerup", release, true);
  doc.addEventListener("focusin", focus);
  doc.addEventListener("focusout", blur);
  doc.addEventListener("keydown", key);
  doc.addEventListener("scroll", scroll, true);
  doc.addEventListener("wheel", dismiss, { capture: true, passive: true });
  win.addEventListener("blur", away);
  return () => {
    win.clearTimeout(timer);
    win.clearTimeout(handOff);
    watch.disconnect();
    doc.removeEventListener("pointerover", over);
    doc.removeEventListener("pointerout", out);
    doc.removeEventListener("pointerdown", press, true);
    doc.removeEventListener("pointerup", release, true);
    doc.removeEventListener("focusin", focus);
    doc.removeEventListener("focusout", blur);
    doc.removeEventListener("keydown", key);
    doc.removeEventListener("scroll", scroll, true);
    doc.removeEventListener("wheel", dismiss, true);
    win.removeEventListener("blur", away);
  };
}

export function TooltipLayer() {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<{ el: HTMLElement; text: string; report: TipBlock[] | null } | null>(null);
  const [place, setPlace] = useState<TipPlace | null>(null);

  // The same anchor again is new text: it stays in place and is placed anew,
  // rather than sliding in again.
  const anchor = useRef<HTMLElement | null>(null);
  useEffect(
    () =>
      watchTips(document, (el) => {
        if (el !== anchor.current) setPlace(null);
        anchor.current = el;
        const report = el?.dataset.tipReport;
        setShown(el ? { el, text: el.dataset.tip ?? "", report: report ? (JSON.parse(report) as TipBlock[]) : null } : null);
      }),
    [],
  );

  // Described while shown. A control that unmounts under the tip hides it.
  useEffect(() => {
    if (!shown) return;
    const el = shown.el;
    const prior = el.getAttribute("aria-describedby");
    el.setAttribute("aria-describedby", prior ? `${prior} ${id}` : id);
    return () => {
      if (prior) el.setAttribute("aria-describedby", prior);
      else el.removeAttribute("aria-describedby");
    };
  }, [shown, id]);

  // Measured hidden at its natural width, then placed before the next paint.
  useLayoutEffect(() => {
    const el = box.current;
    if (!shown || !el) return;
    if (!shown.el.isConnected) {
      setShown(null);
      return;
    }
    // Toward the pane row, unless the anchor names its side, which it keeps (a
    // pane header: above, over the top strip), or asks for the right (a Data
    // row: beside it, flipping left where there is no room).
    const side = shown.el.dataset.tipSide;
    const named = side === "above" || side === "below";
    const prefer = named ? side : shown.el.closest(".bottombar") ? "above" : "below";
    const win = { width: window.innerWidth, height: window.innerHeight };
    const anchorBox = shown.el.getBoundingClientRect();
    const tipBox = el.getBoundingClientRect();
    setPlace(side === "right" ? placeTipBeside(anchorBox, tipBox, win) : placeTip(anchorBox, tipBox, win, prefer, named));
  }, [shown]);

  // Whole px, so the outline and its pointer land on the pixel grid.
  const style = place
    ? ({ left: Math.round(place.left), top: Math.round(place.top), "--tip-at": `${Math.round(place.pointer)}px` } as CSSProperties)
    : undefined;
  return (
    <div ref={box} id={id} role="tooltip" className={`tooltip${shown && place ? " is-shown" : ""}${shown?.el.dataset.tipWide !== undefined ? " is-wide" : ""}`} data-side={place?.side} style={style}>
      {shown && (shown.report ? <TipReport blocks={shown.report} /> : <TipText text={shown.text} />)}
      <span className="tooltip-pointer" aria-hidden="true" />
    </div>
  );
}

function TipText({ text }: { text: string }) {
  return tipParts(text).map((part, i) =>
    i % 2 ? (
      <span key={i} className="tip-caps">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

// A file pill's report: its heading, then its lines, refused ones in the
// refusal hue.
function TipReport({ blocks }: { blocks: TipBlock[] }) {
  return blocks.map((b, i) => (
    <div key={i} className={`tip-block${b.kind === "head" ? " tip-head" : ""}`}>
      {b.kind === "head" ? (
        <>
          <span className="tip-caps tip-role">{b.role}</span>
          {b.file && <span className="tip-muted">{b.file}</span>}
          {b.counts && <span className="tip-muted">{b.counts}</span>}
        </>
      ) : (
        b.lines.map((l, j) => (
          <p key={j} className={`tip-line${l.refused ? " is-refused" : ""}`}>
            {l.text}
          </p>
        ))
      )}
    </div>
  ));
}
