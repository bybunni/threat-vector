export interface HudState {
  playing: boolean;
  timeScale: number;
  timelineNormalized: number;
  showGrid: boolean;
  showTrails: boolean;
  showEvents: boolean;
}

export interface HudCallbacks {
  onTogglePlay: (playing: boolean) => void;
  onTimeScale: (scale: number) => void;
  onTimeline: (normalized: number) => void;
  onLayerToggle: (state: Pick<HudState, "showGrid" | "showTrails" | "showEvents">) => void;
}

export class HudController {
  private readonly statusEl = document.querySelector<HTMLElement>("#status");

  private readonly clockEl = document.querySelector<HTMLElement>("#clock");

  private readonly frameModelEl = document.querySelector<HTMLElement>("#frameModel");

  private readonly cameraModeEl = document.querySelector<HTMLElement>("#cameraMode");

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
    showEvents: true
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
