export const WGS84_A = 6378137.0;
export const WGS84_B = 6356752.314245;
export const WGS84_F = 1 / 298.257223563;
export const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);
export const WGS84_EP2 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

