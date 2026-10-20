// The glide a pane runs when its marks move to a new arrangement (Shells'
// orderings, the matrix's seriations): eased, from wherever the marks are.

export const GLIDE_MS = 450;

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function lerpInto(out: Float32Array, a: ArrayLike<number>, b: ArrayLike<number>, t: number) {
  for (let i = 0; i < out.length; i++) out[i] = a[i]! + (b[i]! - a[i]!) * t;
  return out;
}
