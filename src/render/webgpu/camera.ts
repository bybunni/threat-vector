import type { CameraInputState, CameraMode, CameraPreset } from "../types";

const ORBIT_PERIOD_SECONDS_SOLAR = 86400;
const ORBIT_RATE_RAD_PER_SEC = (2 * Math.PI) / ORBIT_PERIOD_SECONDS_SOLAR;
const PITCH_MIN_RAD = -1.25;
const PITCH_MAX_RAD = 1.25;
const DIST_MIN = 1.15;
const DIST_MAX = 6.0;
const PAN_SCALE = 1.6;
const ORBIT_YAW_SENSITIVITY = Math.PI * 1.5;
const ORBIT_PITCH_SENSITIVITY = Math.PI;
const ZOOM_SENSITIVITY = 0.85;

const CAMERA_PRESETS: Record<CameraPreset, { distance: number; pitchRad: number }> = {
  tactical: { distance: 2.4, pitchRad: 0.45 },
  chase: { distance: 2.4, pitchRad: 0.45 },
  close: { distance: 1.35, pitchRad: 0.55 }
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const add3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2]
];

const scale3 = (v: [number, number, number], s: number): [number, number, number] => [v[0] * s, v[1] * s, v[2] * s];

const sub3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2]
];

const cross3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

const normalize3 = (v: [number, number, number]): [number, number, number] => {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-12) {
    return [0, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
};

export interface CameraState {
  yawRad: number;
  pitchRad: number;
  distance: number;
  chaseEnabled: boolean;
  eye: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
}

interface CameraUpdateParams {
  mode: CameraMode;
  dtSec: number;
  input: CameraInputState;
  presetRequest?: CameraPreset;
  entityLockTarget?: [number, number, number] | null;
  chasePose?: {
    eye: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
  } | null;
}

const zeroInput: CameraInputState = {
  orbitDelta: [0, 0],
  panDelta: [0, 0],
  zoomDelta: 0,
  isInteracting: false
};

const toCameraFrame = (target: [number, number, number], yawRad: number, pitchRad: number, distance: number) => {
  const cosPitch = Math.cos(pitchRad);
  const sinPitch = Math.sin(pitchRad);
  const cosYaw = Math.cos(yawRad);
  const sinYaw = Math.sin(yawRad);

  const eye: [number, number, number] = [
    target[0] + distance * cosPitch * cosYaw,
    target[1] + distance * cosPitch * sinYaw,
    target[2] + distance * sinPitch
  ];
  const forward = normalize3(sub3(target, eye));
  const right = normalize3(cross3(forward, [0, 0, 1]));
  const safeRight: [number, number, number] =
    Math.hypot(right[0], right[1], right[2]) < 1e-6 ? [1, 0, 0] : right;
  const up = normalize3(cross3(safeRight, forward));
  return { eye, up, right: safeRight };
};

export const createInitialCameraState = (): CameraState => {
  const preset = CAMERA_PRESETS.tactical;
  const target: [number, number, number] = [0, 0, 0];
  const yawRad = 0;
  const pitchRad = preset.pitchRad;
  const distance = preset.distance;
  const frame = toCameraFrame(target, yawRad, pitchRad, distance);
  return {
    yawRad,
    pitchRad,
    distance,
    chaseEnabled: false,
    eye: frame.eye,
    target,
    up: frame.up
  };
};

export const applyCameraPreset = (state: CameraState, preset: CameraPreset): CameraState => {
  if (preset === "chase") {
    return {
      ...state,
      chaseEnabled: true
    };
  }
  const p = CAMERA_PRESETS[preset];
  const nextPitch = clamp(p.pitchRad, PITCH_MIN_RAD, PITCH_MAX_RAD);
  const nextDistance = clamp(p.distance, DIST_MIN, DIST_MAX);
  const frame = toCameraFrame(state.target, state.yawRad, nextPitch, nextDistance);
  return {
    ...state,
    chaseEnabled: false,
    pitchRad: nextPitch,
    distance: nextDistance,
    eye: frame.eye,
    up: frame.up
  };
};

export const updateCameraState = (prev: CameraState, params: CameraUpdateParams): CameraState => {
  const input = params.input ?? zeroInput;
  let state = prev;

  if (params.presetRequest) {
    state = applyCameraPreset(state, params.presetRequest);
  }

  let yawRad = state.yawRad;
  let pitchRad = state.pitchRad;
  let distance = state.distance;
  let target = state.target;

  if (params.mode === "entityLock" && params.entityLockTarget) {
    target = params.entityLockTarget;
  }

  if (params.mode === "entityLock" && state.chaseEnabled && params.chasePose) {
    return {
      ...state,
      target: params.chasePose.target,
      eye: params.chasePose.eye,
      up: params.chasePose.up
    };
  }

  if (params.mode === "orbit" && !input.isInteracting) {
    yawRad += params.dtSec * ORBIT_RATE_RAD_PER_SEC;
  }

  yawRad += input.orbitDelta[0] * ORBIT_YAW_SENSITIVITY;
  pitchRad += input.orbitDelta[1] * ORBIT_PITCH_SENSITIVITY;
  pitchRad = clamp(pitchRad, PITCH_MIN_RAD, PITCH_MAX_RAD);

  distance *= Math.exp(input.zoomDelta * ZOOM_SENSITIVITY);
  distance = clamp(distance, DIST_MIN, DIST_MAX);

  const initialFrame = toCameraFrame(target, yawRad, pitchRad, distance);
  if (params.mode !== "entityLock") {
    const panX = -input.panDelta[0] * distance * PAN_SCALE;
    const panY = input.panDelta[1] * distance * PAN_SCALE;
    target = add3(target, add3(scale3(initialFrame.right, panX), scale3(initialFrame.up, panY)));
  }

  const frame = toCameraFrame(target, yawRad, pitchRad, distance);
  return {
    yawRad,
    pitchRad,
    distance,
    chaseEnabled: state.chaseEnabled,
    eye: frame.eye,
    target,
    up: frame.up
  };
};
