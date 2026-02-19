import { describe, expect, it } from "vitest";
import { applyCameraPreset, createInitialCameraState, updateCameraState } from "../src/render/webgpu";

const noInput = {
  orbitDelta: [0, 0] as [number, number],
  panDelta: [0, 0] as [number, number],
  zoomDelta: 0,
  isInteracting: false
};

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

  it("uses chase pose when chase preset is enabled", () => {
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
    expect(state1.eye).toEqual(chasePose.eye);
    expect(state1.target).toEqual(chasePose.target);
  });
});
