import { describe, expect, it } from "vitest";
import { bandRows, labelOrder, rowAt, sameOrder, sortRank, sortValue } from "./order";

const ids = (a: Uint32Array) => Array.from(a);

const upTo = (n: number) => Uint32Array.from({ length: n }, (_, i) => i);

describe("labelOrder", () => {
  it("is the rank when nothing is selected", () => {
    expect(ids(labelOrder(Uint32Array.of(3, 0, 2, 1), new Set()))).toEqual([3, 0, 2, 1]);
  });

  it("puts selected rows first, each group in rank order", () => {
    expect(ids(labelOrder(upTo(6), new Set([4, 1])))).toEqual([1, 4, 0, 2, 3, 5]);
    expect(ids(labelOrder(Uint32Array.of(5, 4, 3, 2, 1, 0), new Set([1, 4])))).toEqual([4, 1, 5, 3, 2, 0]);
  });

  it("is the rank when everything is selected", () => {
    expect(ids(labelOrder(upTo(3), new Set([2, 0, 1])))).toEqual([0, 1, 2]);
  });

  it("handles an empty graph", () => {
    expect(labelOrder(new Uint32Array(0), new Set()).length).toBe(0);
  });
});

describe("sortRank", () => {
  const keys = {
    labels: ["beta", "", "Alpha", "item 10", "item 9", "alpha"],
    degree: [1, 3, 3, 2, 5, 1],
    onion: [1, 4, 4, 2, 4, 1],
  };

  it("sorts alphabetically by case and number, empty labels last, ties by node_id", () => {
    expect(ids(sortRank("alpha", keys))).toEqual([2, 5, 0, 4, 3, 1]);
  });

  it("sorts by degree, most first, ties by node_id", () => {
    expect(ids(sortRank("degree", keys))).toEqual([4, 1, 2, 3, 0, 5]);
  });

  it("sorts by onion, deepest first, then degree, then node_id", () => {
    expect(ids(sortRank("onion", keys))).toEqual([4, 1, 2, 3, 0, 5]);
  });

  it("keeps node_id order when there are no labels", () => {
    expect(ids(sortRank("alpha", { ...keys, labels: ["", "", "", "", "", ""] }))).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("sameOrder", () => {
  it("compares length and contents", () => {
    const a = Uint32Array.of(1, 0, 2);
    expect(sameOrder(a, Uint32Array.of(1, 0, 2))).toBe(true);
    expect(sameOrder(a, Uint32Array.of(0, 1, 2))).toBe(false);
    expect(sameOrder(a, Uint32Array.of(1, 0))).toBe(false);
  });
});

describe("rowAt", () => {
  // pad 10, pitch 30: row 0 spans y 10..40, row 1 spans 40..70, ...
  it("maps content y to a row, gaps included", () => {
    expect(rowAt(10, 30, 10, 3)).toBe(0);
    expect(rowAt(39.9, 30, 10, 3)).toBe(0);
    expect(rowAt(40, 30, 10, 3)).toBe(1);
    expect(rowAt(99, 30, 10, 3)).toBe(2);
  });

  it("is null in the padding and below the last row", () => {
    expect(rowAt(5, 30, 10, 3)).toBeNull();
    expect(rowAt(100, 30, 10, 3)).toBeNull();
  });
});

describe("bandRows", () => {
  it("snaps to every row the band touches, in either direction", () => {
    expect(bandRows(15, 45, 30, 10, 5)).toEqual([0, 1]);
    expect(bandRows(45, 15, 30, 10, 5)).toEqual([0, 1]);
  });

  it("clamps a band that runs past either end", () => {
    expect(bandRows(0, 1000, 30, 10, 5)).toEqual([0, 4]);
  });

  it("is null wholly below the last row or above the first", () => {
    expect(bandRows(170, 300, 30, 10, 5)).toBeNull();
    expect(bandRows(0, 8, 30, 10, 5)).toBeNull();
    expect(bandRows(0, 8, 30, 10, 0)).toBeNull();
  });
});

describe("sortValue", () => {
  const keys = {
    labels: ["a", "b", "c"],
    degree: [3, 12, 7],
    onion: [1, 2, 2],
  };

  it("shows nothing under Labels (A–Z)", () => {
    expect(sortValue("alpha", keys)).toBeNull();
  });

  it("pads integers to the widest with figure spaces", () => {
    const v = sortValue("degree", keys)!;
    expect([0, 1, 2].map(v)).toEqual(["\u20073", "12", "\u20077"]);
    expect(sortValue("onion", keys)!(0)).toBe("1");
  });
});
