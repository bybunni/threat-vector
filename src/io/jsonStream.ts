import { parseFrameMessage } from "../core/schema";
import type { FrameMessage } from "../core/schema";

export const parseNdjsonFrames = (raw: string): FrameMessage[] =>
  raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return parseFrameMessage(JSON.parse(line));
      } catch (error) {
        throw new Error(`Invalid NDJSON frame at line ${index + 1}: ${String(error)}`);
      }
    });

export const parseJsonFrames = (raw: string): FrameMessage[] => {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of frame messages");
  }
  return parsed.map((item, index) => {
    try {
      return parseFrameMessage(item);
    } catch (error) {
      throw new Error(`Invalid frame at index ${index}: ${String(error)}`);
    }
  });
};

export class JsonStreamClient {
  private socket: WebSocket | null = null;

  connect(url: string, onFrame: (frame: FrameMessage) => void, onError?: (error: Error) => void): void {
    this.disconnect();
    const socket = new WebSocket(url);
    socket.onmessage = (event) => {
      try {
        const frame = parseFrameMessage(JSON.parse(String(event.data)));
        onFrame(frame);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };
    socket.onerror = () => {
      onError?.(new Error(`WebSocket error: ${url}`));
    };
    this.socket = socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

