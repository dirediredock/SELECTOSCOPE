// Contrast's fade: an ink drawn at a share of its strength over the panel.
// An opaque ink mixes toward the panel, so faded marks that overlap never
// stack darker; a translucent one keeps its colour and scales its alpha, which
// is the same blend over the panel.

type Rgba = [number, number, number, number];

function parse(color: string): Rgba | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (!fn) return null;
  const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

// The share an unselected ink draws at, for a Contrast percent: full at 0%,
// down to the floor at 100%, so the pattern never vanishes.
const FLOOR = 0.1;

export function contrastShare(contrast: number) {
  return 1 - ((1 - FLOOR) * contrast) / 100;
}

// `share` in (0, 1]; an unreadable colour draws as it is.
export function fade(color: string, panel: string, share: number): string {
  if (share >= 1) return color;
  const c = parse(color);
  if (!c) return color;
  const [r, g, b, a] = c;
  if (a < 1) return `rgba(${r}, ${g}, ${b}, ${+(a * share).toFixed(4)})`;
  const p = parse(panel);
  if (!p) return color;
  const mix = (i: number) => Math.round(c[i]! * share + p[i]! * (1 - share));
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}
