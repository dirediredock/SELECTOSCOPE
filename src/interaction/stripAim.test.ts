import { describe, expect, it } from "vitest";
import { AIM, aimStep, inAim, makeAim } from "./stripAim";
import type { Aim, Point } from "./stripAim";

// A 1600-wide window: Data's bottom edge at y 760, the strip's top at 780,
// its controls centred between x 500 and 1100.
const controls = { left: 500, right: 1100, top: 780 };

// Steps the aim along `path`, returning how far it held (path.length if it
// held the whole way).
function walk(aim: Aim, path: Point[]): number {
  let a: Aim | null = aim;
  for (let i = 0; i < path.length; i++) {
    a = aimStep(a, path[i]);
    if (!a) return i;
  }
  return path.length;
}

const line = (from: Point, to: Point, n: number): Point[] =>
  Array.from({ length: n }, (_, i) => ({
    x: from.x + ((to.x - from.x) * (i + 1)) / n,
    y: from.y + ((to.y - from.y) * (i + 1)) / n,
  }));

describe("makeAim", () => {
  it("runs from the exit point", () => {
    const exit = { x: 200, y: 700 };
    const aim = makeAim(exit, controls)!;
    expect(aim.tip).toEqual(exit);
    expect(aim.lowest).toBe(700);
  });

  it("draws nothing from level with the strip or below it", () => {
    expect(makeAim({ x: 200, y: 780 }, controls)).toBeNull();
    expect(makeAim({ x: 200, y: 800 }, controls)).toBeNull();
  });
});

describe("inAim", () => {
  const aim = makeAim({ x: 200, y: 600 }, controls)!;

  it("holds the tip and the base's ends", () => {
    expect(inAim(aim, aim.tip)).toBe(true);
    expect(inAim(aim, { x: 500, y: 780 })).toBe(true);
    expect(inAim(aim, { x: 1100, y: 780 })).toBe(true);
  });

  it("holds just outside its sides", () => {
    expect(inAim(aim, { x: 500 - AIM.slack + 1, y: 780 })).toBe(true);
  });

  it("leaves out what lies beside it, above it or past the base", () => {
    expect(inAim(aim, { x: 180, y: 700 })).toBe(false);
    expect(inAim(aim, { x: 1000, y: 650 })).toBe(false);
    expect(inAim(aim, { x: 200, y: 580 })).toBe(false);
    expect(inAim(aim, { x: 800, y: 790 })).toBe(false);
  });
});

describe("aimStep", () => {
  it("holds a diagonal from Data's lower half to the centre controls the whole way", () => {
    const exit = { x: 240, y: 600 };
    const path = line(exit, { x: 800, y: 778 }, 40);
    expect(walk(makeAim(exit, controls)!, path)).toBe(path.length);
  });

  it("holds a trip that wobbles a little on the way", () => {
    const exit = { x: 240, y: 600 };
    const path = line(exit, { x: 800, y: 778 }, 40).map((p, i) => ({ x: p.x, y: p.y + (i % 2 ? -6 : 0) }));
    expect(walk(makeAim(exit, controls)!, path)).toBe(path.length);
  });

  it("ends on climbing back, though still inside", () => {
    const exit = { x: 240, y: 600 };
    const down = line(exit, { x: 500, y: 740 }, 10);
    const up = line({ x: 500, y: 740 }, { x: 500, y: 700 }, 10);
    const aim = makeAim(exit, controls)!;
    expect(inAim(aim, { x: 500, y: 700 })).toBe(true);
    const held = walk(aim, [...down, ...up]);
    expect(held).toBeGreaterThan(down.length);
    expect(held).toBeLessThan(down.length + up.length);
  });

  it("ends soon on a level exit", () => {
    const exit = { x: 240, y: 600 };
    // 16 px a move: over within 64 px, though the controls lie that way.
    expect(walk(makeAim(exit, controls)!, line(exit, { x: 400, y: 600 }, 10))).toBeLessThan(4);
  });

  it("ends at once on a level exit toward a neighbour above the controls' ends", () => {
    // NodeLink's right edge, mid-height, controls spanning nearly the strip.
    const exit = { x: 952, y: 447 };
    const wide = { left: 158, right: 1441, top: 823 };
    expect(walk(makeAim(exit, wide)!, line(exit, { x: 1112, y: 447 }, 10))).toBeLessThan(2);
  });

  it("ends at once on an exit upward", () => {
    const exit = { x: 240, y: 600 };
    expect(walk(makeAim(exit, controls)!, line(exit, { x: 300, y: 540 }, 10))).toBeLessThan(2);
  });

  it("ends when the pointer swerves off the controls", () => {
    const exit = { x: 240, y: 600 };
    const path = line(exit, { x: 300, y: 778 }, 20);
    expect(walk(makeAim(exit, controls)!, path)).toBeLessThan(path.length);
  });
});
