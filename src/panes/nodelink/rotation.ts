// NodeLink's 3D orientation: a rotation matrix (3x3, row-major) applied to the
// layout before the orthographic projection. Screen axes: x right, y up, z
// toward the viewer (larger z is nearer). No DOM here, so it is unit-tested
// directly (rotation.test.ts).

export type Mat3 = Float64Array;

export const identity = (): Mat3 => Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1);

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Float64Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[3 * r + c] = a[3 * r]! * b[c]! + a[3 * r + 1]! * b[3 + c]! + a[3 * r + 2]! * b[6 + c]!;
    }
  }
  return out;
}

// Rotation by `angle` radians about the unit axis (x, y, z) (Rodrigues).
export function axisAngle(x: number, y: number, z: number, angle: number): Mat3 {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return Float64Array.of(
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  );
}

// Re-square the basis (Gram-Schmidt), so rounding from many small drags never
// shears the layout.
export function orthonormalize(m: Mat3): Mat3 {
  const unit = (x: number, y: number, z: number) => {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l] as const;
  };
  const a = unit(m[0]!, m[1]!, m[2]!);
  const d = a[0] * m[3]! + a[1] * m[4]! + a[2] * m[5]!;
  const b = unit(m[3]! - d * a[0], m[4]! - d * a[1], m[5]! - d * a[2]);
  return Float64Array.of(
    a[0], a[1], a[2],
    b[0], b[1], b[2],
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
  );
}

// Radians per pixel of drag: a pane-width drag turns the layout about half over.
export const ROTATE_SPEED = 0.008;

// A free trackball: a drag of (dx, dy) screen px (y down) turns the layout
// about the screen axis perpendicular to the drag, so the near side follows
// the pointer from any orientation. Applied on the screen side (the result
// multiplies the current rotation from the left).
export function dragRotation(dx: number, dy: number): Mat3 {
  const len = Math.hypot(dx, dy);
  if (len === 0) return identity();
  return axisAngle(dy / len, dx / len, 0, len * ROTATE_SPEED);
}

export const rotateBy = (r: Mat3, dx: number, dy: number): Mat3 => orthonormalize(multiply(dragRotation(dx, dy), r));

// The opening orientation: tipped 45 degrees so the top leans toward the
// viewer, a three-quarter view that shows depth at a glance. A flat layout
// has no 3D view (state/nodelink.ts), so its rotation stays face-on.
export const START_TILT = Math.PI / 4;

export function startRotation(layout3d: Float32Array | null, n: number): Mat3 {
  return layout3d && isFlat(layout3d, n) ? identity() : axisAngle(1, 0, 0, START_TILT);
}

// Every node at one z, within float noise.
export function isFlat(layout3d: Float32Array, n: number): boolean {
  let z0 = Infinity, z1 = -Infinity;
  for (let v = 0; v < n; v++) {
    const z = layout3d[3 * v + 2]!;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return z1 - z0 < 1e-6;
}

// Rotate every point; write the screen-plane coordinates to `xy` ([x0, y0, ...])
// and the depth (larger is nearer) to `depth`.
export function project(r: Mat3, layout3d: Float32Array, n: number, xy: Float32Array, depth: Float32Array) {
  for (let v = 0; v < n; v++) {
    const x = layout3d[3 * v]!, y = layout3d[3 * v + 1]!, z = layout3d[3 * v + 2]!;
    xy[2 * v] = r[0]! * x + r[1]! * y + r[2]! * z;
    xy[2 * v + 1] = r[3]! * x + r[4]! * y + r[5]! * z;
    depth[v] = r[6]! * x + r[7]! * y + r[8]! * z;
  }
}
