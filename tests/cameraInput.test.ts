import { describe, expect, it } from "vitest";
import { normalizeCanvasDelta } from "../src/ui";

describe("camera input normalization", () => {
  it("normalizes pointer deltas by canvas dimensions", () => {
    const [nx, ny] = normalizeCanvasDelta(50, -25, 200, 100);
    expect(nx).toBeCloseTo(0.25, 6);
    expect(ny).toBeCloseTo(-0.25, 6);
  });

  it("guards against zero-sized canvas", () => {
    const [nx, ny] = normalizeCanvasDelta(10, 10, 0, 0);
    expect(nx).toBe(10);
    expect(ny).toBe(10);
  });
});

