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
const CHASE_PITCH_OFFSET_MIN_RAD = -0.95;
const CHASE_PITCH_OFFSET_MAX_RAD = 0.95;
const CHASE_ZOOM_SCALE_MIN = 0.45;
const CHASE_ZOOM_SCALE_MAX = 2.5;
const CHASE_RECENTER_HALF_LIFE_SEC = 0.35;

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

const safeNormalize3 = (v: [number, number, number], fallback: [number, number, number]): [number, number, number] => {
  const normalized = normalize3(v);
  if (Math.hypot(normalized[0], normalized[1], normalized[2]) < 1e-6) {
    return fallback;
  }
  return normalized;
};

const decayToZero = (value: number, dtSec: number, halfLifeSec: number): number => {
  const safeHalfLife = Math.max(1e-3, halfLifeSec);
  const factor = Math.exp((-Math.log(2) * Math.max(0, dtSec)) / safeHalfLife);
  const next = value * factor;
  return Math.abs(next) < 1e-5 ? 0 : next;
};

export interface CameraState {
  yawRad: number;
  pitchRad: number;
  distance: number;
  chaseEnabled: boolean;
  chaseYawOffsetRad: number;
  chasePitchOffsetRad: number;
  chaseZoomScale: number;
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

const toChaseBasis = (
  target: [number, number, number],
  chasePose: { eye: [number, number, number]; up: [number, number, number] }
): { back: [number, number, number]; right: [number, number, number]; up: [number, number, number]; distance: number } => {
  const baseOffset = sub3(chasePose.eye, target);
  const distance = Math.max(1e-4, Math.hypot(baseOffset[0], baseOffset[1], baseOffset[2]));
  const back = safeNormalize3(baseOffset, [1, 0, 0]);
  const upHint = safeNormalize3(chasePose.up, [0, 0, 1]);

  let right = normalize3(cross3(upHint, back));
  if (Math.hypot(right[0], right[1], right[2]) < 1e-6) {
    right = normalize3(cross3([0, 1, 0], back));
  }
  const safeRight = safeNormalize3(right, [1, 0, 0]);
  const up = safeNormalize3(cross3(back, safeRight), upHint);

  return { back, right: safeRight, up, distance };
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
    chaseYawOffsetRad: 0,
    chasePitchOffsetRad: 0,
    chaseZoomScale: 1,
    eye: frame.eye,
    target,
    up: frame.up
  };
};

export const applyCameraPreset = (state: CameraState, preset: CameraPreset): CameraState => {
  if (preset === "chase") {
    return {
      ...state,
      chaseEnabled: true,
      chaseYawOffsetRad: 0,
      chasePitchOffsetRad: 0,
      chaseZoomScale: 1
    };
  }
  const p = CAMERA_PRESETS[preset];
  const nextPitch = clamp(p.pitchRad, PITCH_MIN_RAD, PITCH_MAX_RAD);
  const nextDistance = clamp(p.distance, DIST_MIN, DIST_MAX);
  const frame = toCameraFrame(state.target, state.yawRad, nextPitch, nextDistance);
  return {
    ...state,
    chaseEnabled: false,
    chaseYawOffsetRad: 0,
    chasePitchOffsetRad: 0,
    chaseZoomScale: 1,
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
  let chaseYawOffsetRad = state.chaseYawOffsetRad;
  let chasePitchOffsetRad = state.chasePitchOffsetRad;
  let chaseZoomScale = state.chaseZoomScale;
  let target = state.target;

  if (params.mode === "entityLock" && params.entityLockTarget) {
    target = params.entityLockTarget;
  }

  if (params.mode === "entityLock" && state.chaseEnabled && params.chasePose) {
    const lockTarget = params.entityLockTarget ?? params.chasePose.target;
    const basis = toChaseBasis(lockTarget, params.chasePose);

    chaseYawOffsetRad += input.orbitDelta[0] * ORBIT_YAW_SENSITIVITY;
    chasePitchOffsetRad += input.orbitDelta[1] * ORBIT_PITCH_SENSITIVITY;
    chasePitchOffsetRad = clamp(chasePitchOffsetRad, CHASE_PITCH_OFFSET_MIN_RAD, CHASE_PITCH_OFFSET_MAX_RAD);

    chaseZoomScale *= Math.exp(input.zoomDelta * ZOOM_SENSITIVITY);
    chaseZoomScale = clamp(chaseZoomScale, CHASE_ZOOM_SCALE_MIN, CHASE_ZOOM_SCALE_MAX);

    const hasOrbitInput = Math.abs(input.orbitDelta[0]) > 1e-9 || Math.abs(input.orbitDelta[1]) > 1e-9;
    if (!input.isInteracting && !hasOrbitInput) {
      chaseYawOffsetRad = decayToZero(chaseYawOffsetRad, params.dtSec, CHASE_RECENTER_HALF_LIFE_SEC);
      chasePitchOffsetRad = decayToZero(chasePitchOffsetRad, params.dtSec, CHASE_RECENTER_HALF_LIFE_SEC);
    }

    const cosPitch = Math.cos(chasePitchOffsetRad);
    const sinPitch = Math.sin(chasePitchOffsetRad);
    const cosYaw = Math.cos(chaseYawOffsetRad);
    const sinYaw = Math.sin(chaseYawOffsetRad);
    const back = safeNormalize3(
      add3(
        add3(scale3(basis.back, cosPitch * cosYaw), scale3(basis.right, cosPitch * sinYaw)),
        scale3(basis.up, sinPitch)
      ),
      basis.back
    );
    const eye = add3(lockTarget, scale3(back, basis.distance * chaseZoomScale));
    const right = safeNormalize3(cross3(basis.up, back), basis.right);
    const up = safeNormalize3(cross3(back, right), basis.up);

    return {
      ...state,
      chaseYawOffsetRad,
      chasePitchOffsetRad,
      chaseZoomScale,
      target: lockTarget,
      eye,
      up
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
    chaseYawOffsetRad,
    chasePitchOffsetRad,
    chaseZoomScale,
    eye: frame.eye,
    target,
    up: frame.up
  };
};
