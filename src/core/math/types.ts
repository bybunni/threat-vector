export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface NedBasis {
  north: Vec3;
  east: Vec3;
  down: Vec3;
}

