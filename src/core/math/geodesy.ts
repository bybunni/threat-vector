import { DEG2RAD, RAD2DEG, WGS84_A, WGS84_B, WGS84_E2, WGS84_EP2 } from "./constants";
import { quatFromBasis, quatMultiply, quatNormalize } from "./quat";
import type { NedBasis, Quat, Vec3 } from "./types";

export type LlaDegM = [latDeg: number, lonDeg: number, altM: number];
export type LlaRadM = [latRad: number, lonRad: number, altM: number];

export const llaDegToRad = ([lat, lon, alt]: LlaDegM): LlaRadM => [lat * DEG2RAD, lon * DEG2RAD, alt];

export const llaRadToDeg = ([lat, lon, alt]: LlaRadM): LlaDegM => [lat * RAD2DEG, lon * RAD2DEG, alt];

export const llaToEcef = (llaDegM: LlaDegM): Vec3 => {
  const [lat, lon, alt] = llaDegToRad(llaDegM);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const x = (n + alt) * cosLat * cosLon;
  const y = (n + alt) * cosLat * sinLon;
  const z = (n * (1 - WGS84_E2) + alt) * sinLat;
  return [x, y, z];
};

export const ecefToLla = (ecef: Vec3): LlaDegM => {
  const [x, y, z] = ecef;
  const p = Math.hypot(x, y);
  if (p < 1e-6) {
    const lat = z >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const alt = Math.abs(z) - WGS84_B;
    return llaRadToDeg([lat, 0, alt]);
  }
  const theta = Math.atan2(z * WGS84_A, p * WGS84_B);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const lat = Math.atan2(
    z + WGS84_EP2 * WGS84_B * sinTheta * sinTheta * sinTheta,
    p - WGS84_E2 * WGS84_A * cosTheta * cosTheta * cosTheta
  );
  const lon = Math.atan2(y, x);
  const sinLat = Math.sin(lat);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const alt = p / Math.cos(lat) - n;
  return llaRadToDeg([lat, lon, alt]);
};

export const nedBasisAtLla = (llaDegM: LlaDegM): NedBasis => {
  const [lat, lon] = llaDegToRad(llaDegM);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  const north: Vec3 = [-sinLat * cosLon, -sinLat * sinLon, cosLat];
  const east: Vec3 = [-sinLon, cosLon, 0];
  const down: Vec3 = [-cosLat * cosLon, -cosLat * sinLon, -sinLat];
  return { north, east, down };
};

export const bodyFrdToEcefQuat = (bodyToNedQuat: Quat, llaDegM: LlaDegM): Quat => {
  const basis = nedBasisAtLla(llaDegM);
  const nedToEcef = quatFromBasis(basis.north, basis.east, basis.down);
  return quatNormalize(quatMultiply(nedToEcef, bodyToNedQuat));
};

export const ecefToWorld = (ecef: Vec3): Vec3 => [ecef[0] / WGS84_A, ecef[1] / WGS84_A, ecef[2] / WGS84_B];

