// The aim to the strip, in Fit. Pure, so it is unit-tested directly
// (stripAim.test.ts); hoverFocus.ts owns the events and the timer.
//
// The controls sit in the middle of the strip, so the
// way to them from an outer pane is diagonal and crosses its neighbours. On
// leaving the focused pane, a triangle runs from the exit point to the
// strip's top edge, as wide as its controls. While the pointer stays inside
// it and doesn't climb back, the panes it crosses never take focus.

export interface Point {
  x: number;
  y: number;
}

export const AIM = {
  // A pointer this close outside the triangle is still inside, so jitter
  // near the tip, where it is narrow, doesn't end it. Kept small: a level
  // move off the focused pane must leave it soon.
  slack: 8,
  // Climbing back more than this above the lowest point reached ends it.
  retreat: 12,
  // A pointer at rest this long hands focus to the pane under it. Long
  // enough for a trackpad finger lift between two swipes.
  rest: 500,
} as const;

// The triangle: a tip and a horizontal base at the strip's top edge.
export interface Aim {
  tip: Point;
  left: number;
  right: number;
  base: number;
  // The lowest y the pointer has reached since leaving.
  lowest: number;
}

// From the last point inside the focused pane to the strip's controls. Null
// when there is no triangle to draw: the exit is level with the strip or
// below it.
export function makeAim(exit: Point, controls: { left: number; right: number; top: number }): Aim | null {
  if (exit.y >= controls.top) return null;
  return {
    tip: exit,
    left: controls.left,
    right: controls.right,
    base: controls.top,
    lowest: exit.y,
  };
}

// Inside the triangle, or within AIM.slack of its sides.
export function inAim(aim: Aim, p: Point): boolean {
  const s = (p.y - aim.tip.y) / (aim.base - aim.tip.y);
  if (s >= 0 && s <= 1) {
    const l = aim.tip.x + s * (aim.left - aim.tip.x);
    const r = aim.tip.x + s * (aim.right - aim.tip.x);
    if (l <= p.x && p.x <= r) return true;
  }
  const left = { x: aim.left, y: aim.base };
  const right = { x: aim.right, y: aim.base };
  return Math.min(toSegment(p, aim.tip, left), toSegment(p, aim.tip, right)) <= AIM.slack;
}

function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// The aim after a move to `p`, or null once it ends: the pointer has left
// the triangle or climbed back.
export function aimStep(aim: Aim, p: Point): Aim | null {
  if (p.y < aim.lowest - AIM.retreat || !inAim(aim, p)) return null;
  return p.y > aim.lowest ? { ...aim, lowest: p.y } : aim;
}
