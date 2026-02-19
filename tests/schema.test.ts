import { describe, expect, it } from "vitest";
import { parseFrameMessage, parseSessionHeader, tryParseFrameMessage } from "../src/core/schema";

describe("schema parser", () => {
  it("parses valid frame messages", () => {
    const frame = parseFrameMessage({
      t: 12.5,
      entities: [
        {
          id: "air-1",
          kind: "platform",
          domain: "air",
          modelId: "f16_faceted",
          pose: {
            positionLlaDegM: [34.1, -117.3, 10000],
            orientationBodyToNedQuat: [0, 0, 0, 1]
          }
        }
      ],
      events: [
        {
          id: "launch-1",
          type: "launch",
          sourceId: "air-1",
          positionLlaDegM: [34.1, -117.3, 10000],
          t: 12.5
        }
      ]
    });
    expect(frame.entities).toHaveLength(1);
    expect(frame.events).toHaveLength(1);
  });

  it("reports validation failures", () => {
    const result = tryParseFrameMessage({
      t: "bad",
      entities: []
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/frame.t/);
    }
  });

  it("parses session header with UTC epoch", () => {
    const header = parseSessionHeader({
      protocolVersion: "1.0",
      scenarioId: "demo"
    });
    expect(header.protocolVersion).toBe("1.0");
    expect(header.scenarioId).toBe("demo");
  });
});
