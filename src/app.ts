import { generateDemoScenario, TimelineStore } from "./core/sim";
import { WebGpuCombatRenderer } from "./render";
import type { CameraMode, RenderOptions, SimulationContext } from "./render";
import { HudController } from "./ui/controls";

export class ThreatVectorApp {
  private readonly canvas: HTMLCanvasElement;

  private readonly timeline = new TimelineStore();

  private readonly renderer: WebGpuCombatRenderer;

  private readonly hud: HudController;

  private playing = true;

  private timeScale = 1;

  private currentTime = 0;

  private range = { start: 0, end: 0, duration: 0 };

  private lastFrameTs = 0;

  private readonly cameraMode: CameraMode = "static";

  private options: RenderOptions = { showGrid: true, showTrails: true, showEvents: true };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGpuCombatRenderer(canvas);
    this.hud = new HudController({
      onTogglePlay: (playing) => {
        this.playing = playing;
      },
      onTimeScale: (scale) => {
        this.timeScale = scale;
      },
      onTimeline: (normalized) => {
        this.currentTime = this.range.start + this.range.duration * normalized;
        this.renderAtCurrentTime(0);
      },
      onLayerToggle: (state) => {
        this.options = { ...this.options, ...state };
      }
    });
  }

  async start(): Promise<void> {
    this.hud.setStatus("Loading scenario");
    const frames = generateDemoScenario();
    this.timeline.setFrames(frames);
    this.range = this.timeline.getRange();
    this.currentTime = this.range.start;
    this.hud.setCameraMode(this.cameraMode);

    try {
      await this.renderer.initialize();
      this.hud.setStatus("Ready");
      this.installResizeHandler();
      requestAnimationFrame(this.tick);
    } catch (error) {
      this.hud.setStatus(`WebGPU unavailable (${String(error)})`);
    }
  }

  private readonly tick = (ts: number): void => {
    if (!this.lastFrameTs) {
      this.lastFrameTs = ts;
    }
    const dtSec = Math.min(0.05, (ts - this.lastFrameTs) / 1000);
    this.lastFrameTs = ts;

    if (this.playing && this.range.duration > 0) {
      this.currentTime += dtSec * this.timeScale;
      if (this.currentTime > this.range.end) {
        this.currentTime = this.range.start;
      }
    }

    this.renderAtCurrentTime(dtSec);
    requestAnimationFrame(this.tick);
  };

  private renderAtCurrentTime(dtSec: number): void {
    const sample = this.timeline.sampleAt(this.currentTime);
    const simContext: SimulationContext = {
      cameraMode: this.cameraMode
    };
    if (this.renderer.isReady()) {
      this.renderer.render(sample, dtSec, this.options, simContext);
    }
    const elapsed = this.currentTime - this.range.start;
    const normalized = this.range.duration > 0 ? elapsed / this.range.duration : 0;
    this.hud.setClock(elapsed);
    this.hud.setTimeline(normalized);
  }

  private installResizeHandler(): void {
    const resize = (): void => {
      this.renderer.resize(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    };
    window.addEventListener("resize", resize);
    resize();
  }
}
