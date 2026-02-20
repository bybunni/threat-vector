import type { CameraMode, CameraPreset } from "../render";

export interface HudState {
  playing: boolean;
  timeScale: number;
  timelineNormalized: number;
  showGrid: boolean;
  showTrails: boolean;
  showEvents: boolean;
  cameraMode: CameraMode;
  cameraTargetEntityId: string | null;
}

export interface HudCallbacks {
  onTogglePlay: (playing: boolean) => void;
  onTimeScale: (scale: number) => void;
  onTimeline: (normalized: number) => void;
  onLayerToggle: (state: Pick<HudState, "showGrid" | "showTrails" | "showEvents">) => void;
  onCameraMode: (mode: CameraMode) => void;
  onCameraTarget: (entityId: string | null) => void;
  onCameraPreset: (preset: CameraPreset) => void;
}

export class HudController {
  private readonly statusEl = document.querySelector<HTMLElement>("#status");

  private readonly clockEl = document.querySelector<HTMLElement>("#clock");

  private readonly frameModelEl = document.querySelector<HTMLElement>("#frameModel");

  private readonly cameraModeEl = document.querySelector<HTMLElement>("#cameraMode");

  private readonly cameraDebugEl = document.querySelector<HTMLElement>("#cameraDebug");

  private readonly cameraModeSelectEl = document.querySelector<HTMLSelectElement>("#cameraModeSelect");

  private readonly cameraTargetSelectEl = document.querySelector<HTMLSelectElement>("#cameraTargetSelect");

  private readonly cameraPresetTacticalEl = document.querySelector<HTMLButtonElement>("#cameraPresetTactical");

  private readonly cameraPresetChaseEl = document.querySelector<HTMLButtonElement>("#cameraPresetChase");

  private readonly cameraPresetCloseEl = document.querySelector<HTMLButtonElement>("#cameraPresetClose");

  private readonly playPauseEl = document.querySelector<HTMLButtonElement>("#playPause");

  private readonly timeScaleEl = document.querySelector<HTMLInputElement>("#timeScale");

  private readonly timelineEl = document.querySelector<HTMLInputElement>("#timeline");

  private readonly toggleGridEl = document.querySelector<HTMLInputElement>("#toggleGrid");

  private readonly toggleTrailsEl = document.querySelector<HTMLInputElement>("#toggleTrails");

  private readonly toggleEventsEl = document.querySelector<HTMLInputElement>("#toggleEvents");

  readonly state: HudState = {
    playing: true,
    timeScale: 1,
    timelineNormalized: 0,
    showGrid: true,
    showTrails: true,
    showEvents: true,
    cameraMode: "static",
    cameraTargetEntityId: null
  };

  constructor(callbacks: HudCallbacks) {
    this.requireElements();

    this.playPauseEl!.addEventListener("click", () => {
      this.state.playing = !this.state.playing;
      this.playPauseEl!.textContent = this.state.playing ? "Pause" : "Play";
      callbacks.onTogglePlay(this.state.playing);
    });

    this.timeScaleEl!.addEventListener("input", () => {
      this.state.timeScale = Number(this.timeScaleEl!.value);
      callbacks.onTimeScale(this.state.timeScale);
    });

    this.timelineEl!.addEventListener("input", () => {
      this.state.timelineNormalized = Number(this.timelineEl!.value);
      callbacks.onTimeline(this.state.timelineNormalized);
    });

    const emitLayerToggle = (): void => {
      this.state.showGrid = this.toggleGridEl!.checked;
      this.state.showTrails = this.toggleTrailsEl!.checked;
      this.state.showEvents = this.toggleEventsEl!.checked;
      callbacks.onLayerToggle({
        showGrid: this.state.showGrid,
        showTrails: this.state.showTrails,
        showEvents: this.state.showEvents
      });
    };
    this.toggleGridEl!.addEventListener("change", emitLayerToggle);
    this.toggleTrailsEl!.addEventListener("change", emitLayerToggle);
    this.toggleEventsEl!.addEventListener("change", emitLayerToggle);

    this.cameraModeSelectEl!.addEventListener("change", () => {
      const mode = this.cameraModeSelectEl!.value as CameraMode;
      this.state.cameraMode = mode;
      this.setCameraMode(mode);
      callbacks.onCameraMode(mode);
    });

    this.cameraTargetSelectEl!.addEventListener("change", () => {
      const id = this.cameraTargetSelectEl!.value || null;
      this.state.cameraTargetEntityId = id;
      callbacks.onCameraTarget(id);
    });

    this.cameraPresetTacticalEl!.addEventListener("click", () => callbacks.onCameraPreset("tactical"));
    this.cameraPresetChaseEl!.addEventListener("click", () => callbacks.onCameraPreset("chase"));
    this.cameraPresetCloseEl!.addEventListener("click", () => callbacks.onCameraPreset("close"));
  }

  setStatus(text: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = `Status: ${text}`;
    }
  }

  setClock(seconds: number): void {
    if (this.clockEl) {
      this.clockEl.textContent = `T+${seconds.toFixed(1)}s`;
    }
  }

  setFrameModel(frameModel: string): void {
    if (this.frameModelEl) {
      this.frameModelEl.textContent = `Frame Model: ${frameModel.toUpperCase()}`;
    }
  }

  setCameraMode(cameraMode: string): void {
    if (this.cameraModeEl) {
      const label = cameraMode === "entityLock" ? "Entity Lock" : cameraMode[0].toUpperCase() + cameraMode.slice(1);
      this.cameraModeEl.textContent = `Camera: ${label}`;
    }
    if (this.cameraModeSelectEl) {
      this.cameraModeSelectEl.value = cameraMode;
    }
  }

  setCameraDebug(
    data: { chaseEnabled: boolean; eyeEcefM: [number, number, number]; rangeToTargetM: number } | null
  ): void {
    if (!this.cameraDebugEl) {
      return;
    }
    if (!data || !data.chaseEnabled) {
      this.cameraDebugEl.textContent = "Chase Cam: n/a";
      return;
    }
    const [x, y, z] = data.eyeEcefM;
    this.cameraDebugEl.textContent = `Chase Cam ECEF[m]: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)} | Range: ${data.rangeToTargetM.toFixed(1)} m`;
  }

  setCameraTargets(entityIds: string[], selectedEntityId: string | null): void {
    if (!this.cameraTargetSelectEl) {
      return;
    }
    const currentValues = Array.from(this.cameraTargetSelectEl.options).map((option) => option.value);
    const desiredValues = ["", ...entityIds];
    const isSame =
      currentValues.length === desiredValues.length &&
      currentValues.every((value, index) => value === desiredValues[index]);

    if (!isSame) {
      this.cameraTargetSelectEl.innerHTML = "";
      const nearestOption = document.createElement("option");
      nearestOption.value = "";
      nearestOption.textContent = "Nearest";
      this.cameraTargetSelectEl.append(nearestOption);
      for (const id of entityIds) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = id;
        this.cameraTargetSelectEl.append(option);
      }
    }

    const selected = selectedEntityId && entityIds.includes(selectedEntityId) ? selectedEntityId : "";
    this.cameraTargetSelectEl.value = selected;
    this.state.cameraTargetEntityId = selected || null;
  }

  setTimeline(normalized: number): void {
    if (this.timelineEl) {
      this.timelineEl.value = String(Math.max(0, Math.min(1, normalized)));
    }
    this.state.timelineNormalized = normalized;
  }

  private requireElements(): void {
    if (
      !this.statusEl ||
      !this.clockEl ||
      !this.frameModelEl ||
      !this.cameraModeEl ||
      !this.cameraDebugEl ||
      !this.cameraModeSelectEl ||
      !this.cameraTargetSelectEl ||
      !this.cameraPresetTacticalEl ||
      !this.cameraPresetChaseEl ||
      !this.cameraPresetCloseEl ||
      !this.playPauseEl ||
      !this.timeScaleEl ||
      !this.timelineEl ||
      !this.toggleGridEl ||
      !this.toggleTrailsEl ||
      !this.toggleEventsEl
    ) {
      throw new Error("Missing required HUD elements");
    }
  }
}
