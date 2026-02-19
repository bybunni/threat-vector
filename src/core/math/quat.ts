import type { Quat, Vec3 } from "./types";
import { normalize3 } from "./vec3";

export const quatIdentity = (): Quat => [0, 0, 0, 1];

export const quatNormalize = (q: Quat): Quat => {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  if (n < 1e-12) {
    return quatIdentity();
  }
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};

export const quatMultiply = (a: Quat, b: Quat): Quat => {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
};

export const quatSlerp = (a: Quat, b: Quat, t: number): Quat => {
  let q1 = quatNormalize(a);
  let q2 = quatNormalize(b);
  let cosHalfTheta = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];
  if (cosHalfTheta < 0) {
    q2 = [-q2[0], -q2[1], -q2[2], -q2[3]];
    cosHalfTheta = -cosHalfTheta;
  }
  if (cosHalfTheta > 0.9995) {
    return quatNormalize([
      q1[0] + (q2[0] - q1[0]) * t,
      q1[1] + (q2[1] - q1[1]) * t,
      q1[2] + (q2[2] - q1[2]) * t,
      q1[3] + (q2[3] - q1[3]) * t
    ]);
  }
  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  if (Math.abs(sinHalfTheta) < 1e-6) {
    return q1;
  }
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  return [
    q1[0] * ratioA + q2[0] * ratioB,
    q1[1] * ratioA + q2[1] * ratioB,
    q1[2] * ratioA + q2[2] * ratioB,
    q1[3] * ratioA + q2[3] * ratioB
  ];
};

export const quatFromBasis = (xAxis: Vec3, yAxis: Vec3, zAxis: Vec3): Quat => {
  const x = normalize3(xAxis);
  const y = normalize3(yAxis);
  const z = normalize3(zAxis);
  const m00 = x[0];
  const m01 = y[0];
  const m02 = z[0];
  const m10 = x[1];
  const m11 = y[1];
  const m12 = z[1];
  const m20 = x[2];
  const m21 = y[2];
  const m22 = z[2];
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return quatNormalize(q);
};

