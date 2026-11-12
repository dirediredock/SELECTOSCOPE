import { bandStart, inBand } from "../state/sweepRun";
import type { SweepVoice } from "../state/sweepRun";

// The sweep's sound, as pure functions (voices.test.ts): which marks sound at
// a step, and the notes they make together.

// The marks that came into the band between two steps: lit at `step`, not at
// `prev`. The band's leading edge going forward, its trailing one going back.
export function entering(voice: SweepVoice, step: number, prev: number, w: number, wrap: boolean): number[] {
  const now = bandStart(step, w, wrap);
  const was = bandStart(prev, w, wrap);
  const ids: number[] = [];
  for (let i = 0; i < voice.at.length; i++) {
    const p = voice.at[i]!;
    if (inBand(p, now, w, wrap) && !inBand(p, was, w, wrap)) ids.push(i);
  }
  return ids;
}

// Values stretched linearly onto [0, 1], the smallest at 0 and the largest at
// 1. Values with no spread have no ends, so they sit in the middle. Why: a
// pane's places across rarely fill its whole extent, and a pitch range or a
// length range should be used end to end.
export function spread(values: ArrayLike<number>): Float64Array {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    lo = Math.min(lo, values[i]!);
    hi = Math.max(hi, values[i]!);
  }
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = hi > lo ? (values[i]! - lo) / (hi - lo) : 0.5;
  return out;
}

export interface Tone {
  freq: number; // Hz
  gain: number; // its share of full loudness
  ring: number; // how long it rings, in seconds
}

// Four octaves up from A2, on the major pentatonic scale: no two notes a
// semitone apart, so any chord a step strikes is consonant.
const LOW_HZ = 110;
const OCTAVES = 4;
const PENTATONIC = [0, 2, 4, 7, 9];
const SEMITONES = Array.from({ length: 12 * OCTAVES + 1 }, (_, s) => s).filter((s) => PENTATONIC.includes(s % 12));
export const NOTE_HZ: readonly number[] = SEMITONES.map((s) => LOW_HZ * 2 ** (s / 12));

// The note nearest a place in [0, 1] up the range, the lower on a tie.
export function noteOf(p: number): number {
  const x = Math.min(1, Math.max(0, p)) * 12 * OCTAVES;
  let best = 0;
  for (let i = 1; i < SEMITONES.length; i++) if (Math.abs(SEMITONES[i]! - x) < Math.abs(SEMITONES[best]! - x)) best = i;
  return best;
}

// A tone's gain: every tone is this loud until a step holds LONE_SHARE of
// them, past which the step's tones share full loudness.
const LONE_SHARE = 4;

// How long a tone rings, in seconds, from its marks' length places: the
// shortest at 0, the longest at 1.
export const RING = { short: 0.3, long: 4 } as const;

// The tones of one step's marks, by each mark's pitch place and length place,
// both in [0, 1]: marks on one note make one tone, ringing for their mean
// length. Every tone of a step is struck equally loud, so a lone mark is
// never lost under a crowd.
export function tonesOf(pitches: ArrayLike<number>, lengths: ArrayLike<number>): Tone[] {
  const count = new Uint32Array(NOTE_HZ.length);
  const length = new Float64Array(NOTE_HZ.length);
  for (let i = 0; i < pitches.length; i++) {
    const k = noteOf(pitches[i]!);
    count[k]!++;
    length[k]! += lengths[i]!;
  }
  let tones = 0;
  for (const c of count) if (c) tones++;
  const gain = 1 / Math.max(LONE_SHARE, tones);
  return Array.from(count).flatMap((c, k) =>
    c ? [{ freq: NOTE_HZ[k]!, gain, ring: RING.short + (length[k]! / c) * (RING.long - RING.short) }] : [],
  );
}
