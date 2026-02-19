import { describe, expect, it } from "vitest";
import { bodyFrdToEcefQuat, ecefToLla, llaToEcef, nedBasisAtLla } from "../src/core/math";

describe("geodesy", () => {
  it("round-trips LLA <-> ECEF with low error", () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0],
      [34.25, -117.8, 2500],
      [-70.2, 45.4, 100],
      [80.0, 179.1, 12000]
    ];
    for (const sample of samples) {
      const ecef = llaToEcef(sample);
      const roundTrip = ecefToLla(ecef);
      expect(roundTrip[0]).toBeCloseTo(sample[0], 5);
      expect(roundTrip[1]).toBeCloseTo(sample[1], 5);
      expect(roundTrip[2]).toBeCloseTo(sample[2], 2);
    }
  });

  it("builds an orthonormal NED basis", () => {
    const basis = nedBasisAtLla([45, -90, 0]);
    const dot = (a: [number, number, number], b: [number, number, number]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(basis.north, basis.east)).toBeCloseTo(0, 6);
    expect(dot(basis.north, basis.down)).toBeCloseTo(0, 6);
    expect(dot(basis.east, basis.down)).toBeCloseTo(0, 6);
    expect(dot(basis.north, basis.north)).toBeCloseTo(1, 6);
    expect(dot(basis.east, basis.east)).toBeCloseTo(1, 6);
    expect(dot(basis.down, basis.down)).toBeCloseTo(1, 6);
  });

  it("returns a normalized body->ecef quaternion", () => {
    const q = bodyFrdToEcefQuat([0, 0, 0, 1], [20, 30, 0]);
    const n = Math.hypot(q[0], q[1], q[2], q[3]);
    expect(n).toBeCloseTo(1, 6);
  });
});

