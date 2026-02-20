import { describe, expect, it } from "vitest";
import { applyCameraPreset, createInitialCameraState, updateCameraState } from "../src/render/webgpu";

const noInput = {
  orbitDelta: [0, 0] as [number, number],
  panDelta: [0, 0] as [number, number],
  zoomDelta: 0,
  isInteracting: false
};

const dist3 = (a: [number, number, number], b: [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("camera mode", () => {
  it("keeps static camera eye stable", () => {
    const state0 = createInitialCameraState();
    const state1 = updateCameraState(state0, { mode: "static", dtSec: 10, input: noInput });
    const state2 = updateCameraState(state1, { mode: "static", dtSec: 10, input: noInput });
    expect(state0.eye).toEqual(state1.eye);
    expect(state1.eye).toEqual(state2.eye);
  });

  it("moves orbit camera at a 24-hour period", () => {
    const state0 = createInitialCameraState();
    const state1 = updateCameraState(state0, { mode: "orbit", dtSec: 3600, input: noInput });
    const yawDelta = state1.yawRad - state0.yawRad;
    const expected = (2 * Math.PI) / 24;
    expect(yawDelta).toBeCloseTo(expected, 8);
  });

  it("applies distance and pitch constraints", () => {
    const state0 = createInitialCameraState();
    const state1 = updateCameraState(state0, {
      mode: "static",
      dtSec: 0,
      input: {
        ...noInput,
        orbitDelta: [0, 100],
        zoomDelta: -100
      }
    });
    expect(state1.pitchRad).toBeLessThanOrEqual(1.25);
    expect(state1.distance).toBeGreaterThanOrEqual(1.15);
  });

  it("locks target in entity lock mode", () => {
    const state0 = createInitialCameraState();
    const lockTarget: [number, number, number] = [0.5, -0.3, 0.1];
    const state1 = updateCameraState(state0, {
      mode: "entityLock",
      dtSec: 0.016,
      input: noInput,
      entityLockTarget: lockTarget
    });
    expect(state1.target).toEqual(lockTarget);
  });

  it("applies presets", () => {
    const state0 = createInitialCameraState();
    const state1 = applyCameraPreset(state0, "chase");
    const state2 = applyCameraPreset(state1, "close");
    expect(state1.chaseEnabled).toBe(true);
    expect(state2.distance).toBeLessThan(state1.distance);
    expect(state2.chaseEnabled).toBe(false);
  });

  it("matches chase anchor when chase preset is enabled and no input is provided", () => {
    const state0 = createInitialCameraState();
    const chasePreset = applyCameraPreset(state0, "chase");
    const chasePose = {
      eye: [0.1, 0.2, 0.3] as [number, number, number],
      target: [0.0, 0.1, 0.2] as [number, number, number],
      up: [0, 0, 1] as [number, number, number]
    };
    const state1 = updateCameraState(chasePreset, {
      mode: "entityLock",
      dtSec: 0.016,
      input: noInput,
      entityLockTarget: chasePose.target,
      chasePose
    });
    expect(state1.eye[0]).toBeCloseTo(chasePose.eye[0], 8);
    expect(state1.eye[1]).toBeCloseTo(chasePose.eye[1], 8);
    expect(state1.eye[2]).toBeCloseTo(chasePose.eye[2], 8);
    expect(state1.target).toEqual(chasePose.target);
  });

  it("allows orbiting around a locked target in chase mode", () => {
    const state0 = applyCameraPreset(createInitialCameraState(), "chase");
    const chasePose = {
      eye: [0.1, 0.2, 0.3] as [number, number, number],
      target: [0.0, 0.1, 0.2] as [number, number, number],
      up: [0, 0, 1] as [number, number, number]
    };
    const state1 = updateCameraState(state0, {
      mode: "entityLock",
      dtSec: 0.016,
      input: {
        orbitDelta: [0.12, -0.08],
        panDelta: [0, 0],
        zoomDelta: 0,
        isInteracting: true
      },
      entityLockTarget: chasePose.target,
      chasePose
    });
    expect(state1.target).toEqual(chasePose.target);
    expect(dist3(state1.eye, chasePose.eye)).toBeGreaterThan(1e-4);
  });

  it("ignores pan input while chase mode is active", () => {
    const state0 = applyCameraPreset(createInitialCameraState(), "chase");
    const chasePose = {
      eye: [0.1, 0.2, 0.3] as [number, number, number],
      target: [0.0, 0.1, 0.2] as [number, number, number],
      up: [0, 0, 1] as [number, number, number]
    };
    const baseline = updateCameraState(state0, {
      mode: "entityLock",
      dtSec: 0.016,
      input: noInput,
      entityLockTarget: chasePose.target,
      chasePose
    });
    const withPan = updateCameraState(state0, {
      mode: "entityLock",
      dtSec: 0.016,
      input: {
        orbitDelta: [0, 0],
        panDelta: [0.8, -0.6],
        zoomDelta: 0,
        isInteracting: true
      },
      entityLockTarget: chasePose.target,
      chasePose
    });
    expect(dist3(withPan.eye, baseline.eye)).toBeLessThan(1e-10);
  });

  it("recenters chase orbit offsets after interaction stops", () => {
    const state0 = applyCameraPreset(createInitialCameraState(), "chase");
    const chasePose = {
      eye: [0.1, 0.2, 0.3] as [number, number, number],
      target: [0.0, 0.1, 0.2] as [number, number, number],
      up: [0, 0, 1] as [number, number, number]
    };
    const orbited = updateCameraState(state0, {
      mode: "entityLock",
      dtSec: 0.016,
      input: {
        orbitDelta: [0.2, 0.1],
        panDelta: [0, 0],
        zoomDelta: 0,
        isInteracting: true
      },
      entityLockTarget: chasePose.target,
      chasePose
    });
    const recentered = updateCameraState(orbited, {
      mode: "entityLock",
      dtSec: 0.8,
      input: noInput,
      entityLockTarget: chasePose.target,
      chasePose
    });
    expect(Math.abs(recentered.chaseYawOffsetRad)).toBeLessThan(Math.abs(orbited.chaseYawOffsetRad));
    expect(Math.abs(recentered.chasePitchOffsetRad)).toBeLessThan(Math.abs(orbited.chasePitchOffsetRad));
    expect(dist3(recentered.eye, chasePose.eye)).toBeLessThan(dist3(orbited.eye, chasePose.eye));
  });
});
