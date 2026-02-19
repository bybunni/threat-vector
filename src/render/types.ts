import type { FrameMessage } from "../core/schema";

export interface RenderOptions {
  showGrid: boolean;
  showTrails: boolean;
  showEvents: boolean;
}

export type CameraMode = "static" | "orbit" | "entityLock";

export interface SimulationContext {
  cameraMode: CameraMode;
}

export interface Renderer {
  initialize(): Promise<void>;
  resize(width: number, height: number): void;
  render(frame: FrameMessage, dtSec: number, options: RenderOptions, simContext: SimulationContext): void;
  isReady(): boolean;
}
