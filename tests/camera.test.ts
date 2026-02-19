import { describe, expect, it } from "vitest";
import { createInitialCameraState, updateCameraState } from "../src/render/webgpu";

describe("camera mode", () => {
  it("keeps static camera eye stable", () => {
    const state0 = createInitialCameraState();
    const state1 = updateCameraState(state0, "static", 10);
    const state2 = updateCameraState(state1, "static", 10);
    expect(state0.eye).toEqual(state1.eye);
    expect(state1.eye).toEqual(state2.eye);
  });

  it("moves orbit camera over time", () => {
    const state0 = createInitialCameraState();
    const state1 = updateCameraState(state0, "orbit", 10);
    expect(state1.eye[0]).not.toBe(state0.eye[0]);
    expect(state1.eye[1]).not.toBe(state0.eye[1]);
  });
});

