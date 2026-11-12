import type { Tone } from "./voices";

// The sweep's notes, on the Web Audio API alone. One context, made on the
// click that turns the sound on (a browser plays nothing before a gesture)
// and suspended while it is off.

// The most tones one step plays, its longest.
const TONES_MAX = 24;
const MASTER = 0.7;
const WAVE: OscillatorType = "triangle";
const ATTACK_S = 0.005;
const SILENT = 0.0001;

// A little room around the notes: REVERB of the mix is wet, from a tail
// ROOM_S long.
const REVERB = 0.1;
const ROOM_S = 2;

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;

// A plain room: stereo noise falling 60 dB over `seconds`.
function room(c: AudioContext, seconds: number): AudioBuffer {
  const n = Math.round(c.sampleRate * seconds);
  const buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-6.9 * i) / n);
  }
  return buf;
}

export function wake() {
  if (typeof AudioContext === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    // Dry and wet meet in a compressor, which holds a crowded step's sum
    // under clipping.
    const squeeze = ctx.createDynamicsCompressor();
    squeeze.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = MASTER;
    const dry = ctx.createGain();
    dry.gain.value = Math.cos((REVERB * Math.PI) / 2);
    const wet = ctx.createGain();
    wet.gain.value = Math.sin((REVERB * Math.PI) / 2);
    const verb = ctx.createConvolver();
    verb.buffer = room(ctx, ROOM_S);
    master.connect(dry).connect(squeeze);
    master.connect(verb).connect(wet).connect(squeeze);
    out = master;
  }
  void ctx.resume();
}

export function sleep() {
  void ctx?.suspend();
}

// One note through its own envelope: up in ATTACK_S, then fading out over
// `ring` seconds.
function strike(c: AudioContext, to: AudioNode, { freq, gain, ring }: Tone) {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = WAVE;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(SILENT, t);
  env.gain.exponentialRampToValueAtTime(Math.max(gain, SILENT), t + ATTACK_S);
  env.gain.exponentialRampToValueAtTime(SILENT, t + ring);
  osc.connect(env).connect(to);
  osc.start(t);
  osc.stop(t + ring);
}

export function play(tones: readonly Tone[]) {
  if (!ctx || !out || ctx.state !== "running") return;
  const longest = tones.length > TONES_MAX ? [...tones].sort((a, b) => b.ring - a.ring).slice(0, TONES_MAX) : tones;
  for (const tone of longest) strike(ctx, out, tone);
}
