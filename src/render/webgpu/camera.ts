import type { CameraMode } from "../types";

const STATIC_EYE: [number, number, number] = [2.2, 0, 1.1];
const ORBIT_RATE_RAD_PER_SEC = 0.008;

export interface CameraState {
  orbitAngleRad: number;
  eye: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
}

export const createInitialCameraState = (): CameraState => ({
  orbitAngleRad: 0,
  eye: STATIC_EYE,
  target: [0, 0, 0],
  up: [0, 0, 1]
});

export const updateCameraState = (prev: CameraState, mode: CameraMode, dtSec: number): CameraState => {
  if (mode === "orbit") {
    const orbitAngleRad = prev.orbitAngleRad + dtSec * ORBIT_RATE_RAD_PER_SEC;
    return {
      orbitAngleRad,
      eye: [Math.cos(orbitAngleRad) * 2.2, Math.sin(orbitAngleRad) * 2.2, 1.1],
      target: [0, 0, 0],
      up: [0, 0, 1]
    };
  }
  if (mode === "entityLock") {
    return {
      ...prev,
      eye: STATIC_EYE
    };
  }
  return {
    ...prev,
    eye: STATIC_EYE
  };
};

