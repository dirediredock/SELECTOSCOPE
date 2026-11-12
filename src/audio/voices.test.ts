import { describe, expect, it } from "vitest";
import { SWEEP_STEPS } from "../state/sweepRun";
import type { SweepVoice } from "../state/sweepRun";
import { NOTE_HZ, RING, entering, noteOf, spread, tonesOf } from "./voices";

const voice = (at: number[]): SweepVoice => ({ type: "node", at, pitch: at.map(() => 0) });

describe("entering", () => {
  // Marks at every tenth of the axis; a band a fifth of it thick.
  const v = voice([0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]);
  const w = 0.2;

  it("sounds every mark once in a pass, in axis order", () => {
    const heard: number[] = [];
    for (let s = 1; s < SWEEP_STEPS; s++) heard.push(...entering(v, s, s - 1, w, false));
    expect(heard).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("sounds every mark once in a wrapping pass too", () => {
    const heard: number[] = [];
    for (let s = 1; s <= SWEEP_STEPS; s++) heard.push(...entering(v, s % SWEEP_STEPS, s - 1, w, true));
    expect(heard.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("sounds what the trailing edge takes up on a step back", () => {
    // Step 30's band starts at 0.4; a step back takes it to 0.38.
    expect(entering(v, 29, 30, w, false)).toEqual([]);
    const heard: number[] = [];
    for (let s = 30; s > 20; s--) heard.push(...entering(v, s - 1, s, w, false));
    expect(heard).toEqual([3, 2]);
  });

  it("sounds nothing while the band stays", () => {
    expect(entering(v, 30, 30, w, false)).toEqual([]);
  });
});

describe("spread", () => {
  it("stretches values end to end, the smallest at 0 and the largest at 1", () => {
    expect(Array.from(spread([2, 4, 3]))).toEqual([0, 1, 0.5]);
  });

  it("puts values with no spread in the middle", () => {
    expect(Array.from(spread([7, 7]))).toEqual([0.5, 0.5]);
  });
});

describe("noteOf", () => {
  it("runs four octaves up the pentatonic scale from 110 Hz", () => {
    expect(NOTE_HZ[noteOf(0)]).toBe(110);
    expect(NOTE_HZ[noteOf(1)]).toBeCloseTo(1760);
    expect(NOTE_HZ).toHaveLength(21);
  });

  it("never puts two notes a semitone apart", () => {
    for (let k = 1; k < NOTE_HZ.length; k++) expect(12 * Math.log2(NOTE_HZ[k]! / NOTE_HZ[k - 1]!)).toBeGreaterThan(1.5);
  });

  it("takes the nearest note, rising with the place", () => {
    const notes = Array.from({ length: 101 }, (_, i) => noteOf(i / 100));
    expect(notes).toEqual([...notes].sort((a, b) => a - b));
    expect(new Set(notes).size).toBe(NOTE_HZ.length);
  });
});

describe("tonesOf", () => {
  it("rings a lowest-degree mark shortest and a highest-degree one longest", () => {
    expect(tonesOf([0], [0])).toEqual([{ freq: 110, gain: 0.25, ring: RING.short }]);
    expect(tonesOf([0], [1])[0]!.ring).toBe(RING.long);
  });

  it("merges marks on one note into one tone, ringing for their mean length, no louder", () => {
    const many = tonesOf([0.5, 0.5, 0.5], [0, 0.5, 1]);
    expect(many).toHaveLength(1);
    expect(many[0]!.ring).toBeCloseTo(RING.short + 0.5 * (RING.long - RING.short));
    expect(many[0]!.gain).toBe(tonesOf([0.5], [0])[0]!.gain);
  });

  it("strikes a lone mark as loud as the crowd beside it", () => {
    const [crowd, lone] = tonesOf([0, 0, 0, 0, 0, 0, 0, 1], new Array(8).fill(0));
    expect(lone!.gain).toBe(crowd!.gain);
  });

  it("never grows past full loudness, however crowded", () => {
    const n = 5000;
    const tones = tonesOf(Array.from({ length: n }, (_, i) => i / (n - 1)), new Array(n).fill(0));
    expect(tones).toHaveLength(NOTE_HZ.length);
    expect(tones.reduce((a, t) => a + t.gain, 0)).toBeCloseTo(1);
  });
});
