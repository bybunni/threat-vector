import { describe, expect, it } from "vitest";
import { TimelineStore } from "../src/core/sim";
import type { FrameMessage } from "../src/core/schema";

const frameAt = (t: number, lon: number): FrameMessage => ({
  t,
  entities: [
    {
      id: "air-1",
      kind: "platform",
      domain: "air",
      modelId: "f16_faceted",
      pose: {
        positionLlaDegM: [0, lon, 10000],
        orientationBodyToNedQuat: [0, 0, 0, 1]
      }
    }
  ]
});

describe("timeline store", () => {
  it("interpolates between frames", () => {
    const timeline = new TimelineStore();
    timeline.setFrames([frameAt(0, 0), frameAt(10, 10)]);
    const sample = timeline.sampleAt(5);
    expect(sample.entities).toHaveLength(1);
    expect(sample.entities[0].pose.positionLlaDegM[1]).toBeCloseTo(5, 1);
  });

  it("indexes nearby events", () => {
    const timeline = new TimelineStore();
    timeline.setFrames([
      {
        t: 0,
        entities: [],
        events: [{ id: "e0", type: "launch", positionLlaDegM: [0, 0, 0], t: 0 }]
      },
      {
        t: 2,
        entities: [],
        events: [{ id: "e2", type: "impact", positionLlaDegM: [0, 0, 0], t: 2 }]
      }
    ]);
    const near = timeline.eventsNear(0.05, 0.1);
    expect(near).toHaveLength(1);
    expect(near[0].id).toBe("e0");
  });

  it("provides runtime ECEF samples without requiring LLA roundtrip for render path", () => {
    const timeline = new TimelineStore();
    timeline.setFrames([frameAt(0, 0), frameAt(10, 10)]);
    const runtime = timeline.sampleAtRuntime(5);
    expect(runtime.entities).toHaveLength(1);
    expect(runtime.entities[0].positionEcefM).toHaveLength(3);
    expect(Number.isFinite(runtime.entities[0].positionEcefM[0])).toBe(true);
  });
});
