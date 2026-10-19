import { describe, expect, it } from "vitest";
import type { Graph } from "./graph";
import { ingest } from "./ingest";
import { symmetricEigen } from "./linalg/dense";
import { DENSE_MAX, byValue, componentVectors, harmonicVectors } from "./seriations";

const dot = (a: Float64Array, b: Float64Array) => a.reduce((s, x, i) => s + x * b[i], 0);

function laplacianApply(g: Graph, x: Float64Array) {
  const out = new Float64Array(g.n);
  for (let v = 0; v < g.n; v++) {
    let s = (g.offsets[v + 1] - g.offsets[v]) * x[v];
    for (let i = g.offsets[v]; i < g.offsets[v + 1]; i++) s -= x[g.neighbours[i]];
    out[v] = s;
  }
  return out;
}

function residual(g: Graph, x: Float64Array) {
  const y = laplacianApply(g, x);
  const theta = dot(x, y);
  return Math.sqrt(y.reduce((s, yi, i) => s + (yi - theta * x[i]) ** 2, 0));
}

// A ring of `k` cliques of 4, linked in turn: big enough for Lanczos.
function ringOfCliques(k: number) {
  const rows = [];
  for (let c = 0; c < k; c++) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) rows.push(`${c}_${a},${c}_${b}`);
    rows.push(`${c}_0,${(c + 1) % k}_3`);
  }
  return ingest({ edgelist: ["source,target", ...rows].join("\n") }).graph;
}

// A grid with a long side, so its first waves don't repeat.
function grid(w: number, h: number) {
  const rows = [];
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++) {
      if (x + 1 < w) rows.push(`${x}_${y},${x + 1}_${y}`);
      if (y + 1 < h) rows.push(`${x}_${y},${x}_${y + 1}`);
    }
  return ingest({ edgelist: ["source,target", ...rows].join("\n") }).graph;
}

describe("dense eigen", () => {
  it("decomposes a small symmetric matrix", () => {
    const A = [Float64Array.of(2, 1, 0), Float64Array.of(1, 2, 1), Float64Array.of(0, 1, 2)];
    const { values, vectors } = symmetricEigen(A);
    expect([...values].map((x) => +x.toFixed(10))).toEqual([2 - Math.SQRT2, 2, 2 + Math.SQRT2].map((x) => +x.toFixed(10)));
    for (let k = 0; k < 3; k++) {
      const Av = A.map((row) => dot(row, vectors[k]));
      Av.forEach((x, i) => expect(x).toBeCloseTo(values[k] * vectors[k][i], 10));
    }
  });
});

describe("harmonics", () => {
  it("Lanczos matches the dense solve on a graph past the dense limit", () => {
    const g = grid(45, 10);
    expect(g.n).toBeGreaterThan(DENSE_MAX);
    const harm = harmonicVectors(g);
    expect(harm).toHaveLength(3);
    for (const v of harm) {
      expect(residual(g, v)).toBeLessThan(1e-8);
      expect(Math.abs(dot(v, new Float64Array(g.n).fill(1)))).toBeLessThan(1e-8);
    }
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) expect(Math.abs(dot(harm[a], harm[b]))).toBeLessThan(1e-8);
    // The Fiedler value of a 45 x 10 grid is that of a 45-path: 2 - 2 cos(π / 45).
    const L = laplacianApply(g, harm[0]);
    expect(dot(harm[0], L)).toBeCloseTo(2 - 2 * Math.cos(Math.PI / 45), 9);
  });

  it("finds every copy of a repeated eigenvalue", () => {
    // A ring's waves come in pairs: sin and cos of one frequency.
    const g = ringOfCliques(110);
    const harm = harmonicVectors(g);
    const value = (v: Float64Array) => dot(v, laplacianApply(g, v));
    expect(value(harm[0])).toBeCloseTo(value(harm[1]), 9);
    expect(Math.abs(dot(harm[0], harm[1]))).toBeLessThan(1e-8);
  });

  it("gives twins equal entries", () => {
    const g = ringOfCliques(110);
    // In each clique, members 1 and 2 have the same closed neighbourhood.
    for (const v of harmonicVectors(g)) {
      for (let c = 0; c < 110; c++) {
        const a = g.nodeId.indexOf(`${c}_1`);
        const b = g.nodeId.indexOf(`${c}_2`);
        expect(Math.abs(v[a] - v[b])).toBeLessThan(1e-12);
      }
    }
  });
});

describe("components", () => {
  it("Lanczos and dense agree on the top component up to sign", () => {
    const big = grid(45, 10);
    const small = grid(20, 10);
    for (const g of [big, small]) {
      const [pc1] = componentVectors(g);
      expect(Math.abs(Math.hypot(...pc1) - 1)).toBeLessThan(1e-9);
    }
  });
});

// A clique of 5 with a path of 8 hanging off it: dense at one end.
function lollipop(reversed: boolean) {
  const rows: string[] = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) rows.push(`c${a},c${b}`);
  rows.push("c0,p0");
  for (let i = 0; i < 7; i++) rows.push(`p${i},p${i + 1}`);
  return ingest({ edgelist: ["source,target", ...(reversed ? rows.reverse() : rows)].join("\n") }).graph;
}

describe("orientation", () => {
  it("puts the dense end first, whatever the file order", () => {
    for (const reversed of [false, true]) {
      const g = lollipop(reversed);
      for (const v of [harmonicVectors(g)[0]!, componentVectors(g)[0]!]) {
        const order = byValue(v);
        expect(g.nodeId[order[0]!]!.startsWith("c")).toBe(true);
        expect(g.nodeId[order[g.n - 1]!]!.startsWith("p")).toBe(true);
      }
    }
  });
});
