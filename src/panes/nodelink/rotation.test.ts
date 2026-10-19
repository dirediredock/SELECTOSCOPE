import { describe, expect, it } from "vitest";
import { axisAngle, dragRotation, identity, multiply, orthonormalize, project, rotateBy, startRotation } from "./rotation";
import type { Mat3 } from "./rotation";

const apply = (r: Mat3, p: [number, number, number]) => {
  const xy = new Float32Array(2), depth = new Float32Array(1);
  project(r, Float32Array.of(...p), 1, xy, depth);
  return [xy[0]!, xy[1]!, depth[0]!];
};

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 5));

describe("dragRotation", () => {
  it("turns the near side right when dragged right", () => {
    // The point nearest the viewer (0, 0, 1) moves toward +x.
    const [x, , z] = apply(dragRotation(40, 0), [0, 0, 1]);
    expect(x).toBeGreaterThan(0);
    expect(z).toBeLessThan(1);
  });

  it("tips the near side down when dragged down (screen y is down)", () => {
    const [, y] = apply(dragRotation(0, 40), [0, 0, 1]);
    expect(y).toBeLessThan(0);
  });

  it("does nothing for no drag", () => {
    close(Array.from(dragRotation(0, 0)), Array.from(identity()));
  });
});

describe("rotations stay rotations", () => {
  it("keeps lengths after many small drags", () => {
    let r = identity();
    for (let i = 0; i < 500; i++) r = rotateBy(r, 7, -3);
    const [x, y, z] = apply(r, [0.3, -0.4, 0.5]);
    expect(Math.hypot(x, y, z)).toBeCloseTo(Math.hypot(0.3, -0.4, 0.5), 6);
  });

  it("orthonormalize leaves a rotation unchanged", () => {
    const r = multiply(axisAngle(1, 0, 0, 0.7), axisAngle(0, 1, 0, -1.1));
    close(Array.from(orthonormalize(r)), Array.from(r));
  });
});

describe("startRotation", () => {
  it("opens a flat layout face-on", () => {
    close(Array.from(startRotation(Float32Array.of(0, 0, 0, 1, 1, 0), 2)), Array.from(identity()));
  });

  it("tips a 3D layout's top toward the viewer", () => {
    const r = startRotation(Float32Array.of(0, 0, -1, 0, 0, 1), 2);
    const [, , depth] = apply(r, [0, 1, 0]);
    expect(depth).toBeCloseTo(Math.SQRT1_2);
  });
});
