// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELAY_MS, HANDOFF_MS, placeTip, tipParts, watchTips } from "./Tooltip";
import { scaled } from "../uiScale";

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;
const win = { width: 1000, height: 800 };
const tip = { width: 200, height: 60 };

describe("placeTip", () => {
  it("opens below the anchor, the gap holding the pointer and its air", () => {
    const place = placeTip(rect(400, 100, 40, 20), tip, win);
    expect(place.side).toBe("below");
    expect(place.top).toBeCloseTo(120 + scaled(24));
    expect(place.left).toBe(320);
    expect(place.pointerX).toBe(100);
  });

  it("opens above in the bottom strip, and flips where there is no room", () => {
    const above = placeTip(rect(400, 700, 40, 20), tip, win, "above");
    expect(above.side).toBe("above");
    expect(above.top).toBeCloseTo(700 - scaled(24) - 60);
    const flipped = placeTip(rect(400, 760, 40, 20), tip, win);
    expect(flipped.side).toBe("above");
    expect(placeTip(rect(400, 10, 40, 20), tip, win, "above").side).toBe("below");
  });

  it("keeps a side the anchor names, held inside the window", () => {
    const kept = placeTip(rect(400, 10, 40, 20), tip, win, "above", true);
    expect(kept.side).toBe("above");
    expect(kept.top).toBeCloseTo(scaled(8));
  });

  it("clamps the pointer inside the bubble's ends", () => {
    const inset = scaled(22.2);
    const atLeft = placeTip(rect(0, 100, 6, 20), tip, win);
    expect(atLeft.left).toBeCloseTo(scaled(8));
    expect(atLeft.pointerX).toBeCloseTo(inset);
    const atRight = placeTip(rect(994, 100, 6, 20), tip, win);
    expect(atRight.left + tip.width).toBeCloseTo(win.width - scaled(8));
    expect(atRight.pointerX).toBeCloseTo(tip.width - inset);
  });
});

describe("tipParts", () => {
  it("splits out runs of caps words as names", () => {
    expect(tipParts("Clears NODES, then EXTEND SET grows it.")).toEqual(["Clears ", "NODES", ", then ", "EXTEND SET", " grows it."]);
  });
});

describe("watchTips", () => {
  let shown: (HTMLElement | null)[];
  let stop: () => void;
  let a: HTMLElement;
  let aLabel: HTMLElement;
  let b: HTMLElement;

  const pointer = (type: string, target: Element, relatedTarget: Element | null = null, buttons = 0) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, buttons, relatedTarget }));
  // Moving from one element to another, as a browser fires it.
  const move = (from: Element | null, to: Element | null) => {
    if (from) pointer("pointerout", from, to);
    if (to) pointer("pointerover", to, from);
  };
  const last = () => shown.at(-1) ?? null;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="a" data-tip="Tip A"><span id="al">A</span></button><button id="b" data-tip="Tip B">B</button>';
    a = document.getElementById("a")!;
    aLabel = document.getElementById("al")!;
    b = document.getElementById("b")!;
    shown = [];
    stop = watchTips(document, (el) => shown.push(el));
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it("shows only after the pointer rests a full delay", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS - 1);
    expect(shown).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(last()).toBe(a);
  });

  it("cancels when the pointer leaves onto nothing", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS / 2);
    move(a, null);
    vi.advanceTimersByTime(DELAY_MS * 2);
    expect(shown).toEqual([]);
  });

  it("stays hidden after a press until the pointer leaves the anchor", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    expect(last()).toBe(a);
    pointer("pointerdown", a);
    expect(last()).toBe(null);
    move(a, aLabel);
    move(aLabel, a);
    vi.advanceTimersByTime(DELAY_MS * 2);
    expect(last()).toBe(null);
    // Leaving and coming back waits a full delay again.
    move(a, null);
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    expect(last()).toBe(a);
  });

  it("shows again at once on the release of a press inside the anchor", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    pointer("pointerdown", aLabel);
    expect(last()).toBe(null);
    pointer("pointerup", aLabel);
    expect(last()).toBe(a);
  });

  it("stays hidden when the press leaves the anchor before its release", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    pointer("pointerdown", a);
    pointer("pointerout", a, b, 1);
    pointer("pointerover", b, a, 1);
    pointer("pointerup", b);
    vi.advanceTimersByTime(DELAY_MS * 2);
    expect(last()).toBe(null);
  });

  it("stays hidden through a release after Esc", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    pointer("pointerup", a);
    expect(last()).toBe(null);
  });

  it("follows the shown anchor's text, and hides when it has none", async () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    const before = shown.length;
    a.dataset.tip = "Tip A, changed";
    await Promise.resolve();
    expect(shown.length).toBe(before + 1);
    expect(last()).toBe(a);
    delete a.dataset.tip;
    await Promise.resolve();
    expect(last()).toBe(null);
  });

  it("keeps a tray's tip while keyboard focus moves inside it", () => {
    document.body.innerHTML = '<div id="t" data-tip="Tray"><button id="t1">1</button><button id="t2">2</button></div>';
    const tray = document.getElementById("t")!;
    const [t1, t2] = [document.getElementById("t1")!, document.getElementById("t2")!];
    // jsdom has no keyboard modality: every focus counts as visible.
    vi.spyOn(Element.prototype, "matches").mockImplementation(() => true);
    t1.focus();
    expect(last()).toBe(tray);
    const before = shown.length;
    t2.focus();
    expect(shown.length).toBe(before);
    expect(last()).toBe(tray);
    vi.restoreAllMocks();
  });

  it("waits an anchor's own rest, even in a hand-off, where it asks to", () => {
    b.dataset.tipRest = String(DELAY_MS * 2);
    b.dataset.tipNoHandoff = "";
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    move(a, b);
    expect(last()).toBe(null);
    vi.advanceTimersByTime(DELAY_MS * 2 - 1);
    expect(last()).toBe(null);
    vi.advanceTimersByTime(1);
    expect(last()).toBe(b);
  });

  it("hands off at once within the hand-off window", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    move(a, null);
    expect(last()).toBe(null);
    vi.advanceTimersByTime(HANDOFF_MS - 1);
    move(null, b);
    expect(last()).toBe(b);
  });

  it("waits a full delay once the hand-off window has closed", () => {
    move(null, a);
    vi.advanceTimersByTime(DELAY_MS);
    move(a, null);
    vi.advanceTimersByTime(HANDOFF_MS);
    move(null, b);
    expect(last()).toBe(null);
    vi.advanceTimersByTime(DELAY_MS);
    expect(last()).toBe(b);
  });
});
