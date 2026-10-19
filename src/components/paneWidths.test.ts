import { describe, expect, it } from "vitest";
import { dragHandle, evenPair, resizeOne, sharesFromRatios, toShares } from "./paneWidths";

const total = (w: number[]) => w.reduce((a, b) => a + b, 0);

describe("sharesFromRatios", () => {
  it("keeps the ratios' proportions and sums to 1", () => {
    const s = sharesFromRatios([1 / 3, 1, 1 / 3]);
    expect(total(s)).toBeCloseTo(1);
    expect(s[1] / s[0]).toBeCloseTo(3);
  });
});

describe("toShares", () => {
  it("divides by the total", () => {
    expect(toShares([100, 300])).toEqual([0.25, 0.75]);
  });
});

describe("dragHandle", () => {
  const w0 = [200, 200, 200, 200];

  it("moves room between the two neighbours", () => {
    expect(dragHandle(w0, 1, 50, 100)).toEqual([200, 250, 150, 200]);
    expect(dragHandle(w0, 1, -50, 100)).toEqual([200, 150, 250, 200]);
  });

  it("pushes past a neighbour at its minimum, nearest first", () => {
    expect(dragHandle(w0, 0, 150, 100)).toEqual([350, 100, 150, 200]);
    expect(dragHandle(w0, 2, -150, 100)).toEqual([200, 150, 100, 350]);
  });

  it("stops when every pane on the far side is at its minimum", () => {
    const w = dragHandle(w0, 0, 1000, 100);
    expect(w).toEqual([500, 100, 100, 100]);
  });

  it("keeps the row's total", () => {
    expect(total(dragHandle(w0, 1, 123, 100))).toBeCloseTo(800);
  });

  it("undoes a push when dragged back, since it works from the start", () => {
    expect(dragHandle(w0, 0, 0, 100)).toEqual(w0);
  });
});

describe("evenPair", () => {
  it("evens the two panes and leaves the rest", () => {
    expect(evenPair([100, 300, 200], 0)).toEqual([200, 200, 200]);
  });

  it("stops a pane at its widest and gives the rest to the other", () => {
    expect(evenPair([100, 300, 200], 0, [150])).toEqual([150, 250, 200]);
    expect(evenPair([300, 100, 200], 0, [Infinity, 150])).toEqual([250, 150, 200]);
  });
});

describe("dragHandle with a widest", () => {
  const w0 = [200, 200, 200, 200];

  it("stops the growing pane at its widest", () => {
    expect(dragHandle(w0, 0, 150, 100, [260])).toEqual([260, 140, 200, 200]);
    expect(dragHandle(w0, 0, -50, 100, [260])).toEqual([150, 250, 200, 200]);
  });

  it("caps the pane that grows to the right of a handle too", () => {
    expect(dragHandle(w0, 0, -150, 100, [Infinity, 230])).toEqual([170, 230, 200, 200]);
  });

  it("leaves a pane already at its widest where it is", () => {
    expect(dragHandle([260, 200, 200], 0, 50, 100, [260])).toEqual([260, 200, 200]);
  });
});

describe("resizeOne", () => {
  it("grows a pane by taking from the others' room above the minimum", () => {
    const w = resizeOne([200, 200, 400], 0, 400, 100);
    expect(w[0]).toBe(400);
    // Room above the minimum: 100 and 300, so they give 50 and 150.
    expect(w[1]).toBeCloseTo(150);
    expect(w[2]).toBeCloseTo(250);
  });

  it("shrinks a pane by giving to the others in proportion", () => {
    const w = resizeOne([400, 100, 300], 0, 200, 100);
    expect(w[1]).toBeCloseTo(150);
    expect(w[2]).toBeCloseTo(450);
  });

  it("clamps to what the others' minimums leave", () => {
    const w = resizeOne([200, 200, 200], 0, 1000, 100);
    expect(w).toEqual([400, 100, 100]);
    expect(resizeOne([200, 200, 200], 0, 10, 100)[0]).toBe(100);
  });
});
