import type { Vec3 } from "./types";
import { cross3, dot3, normalize3, sub3 } from "./vec3";

export type Mat4 = Float32Array;

export const mat4Identity = (): Mat4 =>
  new Float32Array([
    1, 0, 0, 0, //
    0, 1, 0, 0, //
    0, 0, 1, 0, //
    0, 0, 0, 1
  ]);

export const mat4Multiply = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
};

export const mat4Perspective = (fovYRad: number, aspect: number, near: number, far: number): Mat4 => {
  const f = 1.0 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0
  ]);
};

export const mat4LookAt = (eye: Vec3, center: Vec3, up: Vec3): Mat4 => {
  const zAxis = normalize3(sub3(eye, center));
  const xAxis = normalize3(cross3(up, zAxis));
  const yAxis = cross3(zAxis, xAxis);

  return new Float32Array([
    xAxis[0],
    yAxis[0],
    zAxis[0],
    0,
    xAxis[1],
    yAxis[1],
    zAxis[1],
    0,
    xAxis[2],
    yAxis[2],
    zAxis[2],
    0,
    -dot3(xAxis, eye),
    -dot3(yAxis, eye),
    -dot3(zAxis, eye),
    1
  ]);
};

