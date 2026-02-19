import type { FrameMessage } from "../core/schema";

export interface RenderOptions {
  showGrid: boolean;
  showTrails: boolean;
  showEvents: boolean;
}

export type CameraMode = "static" | "orbit" | "entityLock";
export type CameraPreset = "tactical" | "wide" | "close";

export interface CameraInputState {
  orbitDelta: [number, number];
  panDelta: [number, number];
  zoomDelta: number;
  isInteracting: boolean;
}

export interface SimulationContext {
  cameraMode: CameraMode;
  cameraTargetEntityId?: string;
  userInput: CameraInputState;
  cameraPresetRequest?: CameraPreset;
}

export interface Renderer {
  initialize(): Promise<void>;
  resize(width: number, height: number): void;
  render(frame: FrameMessage, dtSec: number, options: RenderOptions, simContext: SimulationContext): void;
  isReady(): boolean;
}
