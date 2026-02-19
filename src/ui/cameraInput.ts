import type { CameraInputState } from "../render";

const MIN_SIZE = 1;

export const normalizeCanvasDelta = (
  dxPx: number,
  dyPx: number,
  widthPx: number,
  heightPx: number
): [number, number] => [dxPx / Math.max(MIN_SIZE, widthPx), dyPx / Math.max(MIN_SIZE, heightPx)];

interface Point2D {
  x: number;
  y: number;
}

type MouseGesture = "orbit" | "pan" | null;

export class CameraInputController {
  private readonly canvas: HTMLCanvasElement;

  private orbitDelta: [number, number] = [0, 0];

  private panDelta: [number, number] = [0, 0];

  private zoomDelta = 0;

  private isInteracting = false;

  private activePointerId: number | null = null;

  private activeMouseGesture: MouseGesture = null;

  private lastPointerPos: Point2D | null = null;

  private touchPoints = new Map<number, Point2D>();

  private lastTouchCenter: Point2D | null = null;

  private lastTouchDistance = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUpOrCancel);
    this.canvas.addEventListener("pointercancel", this.onPointerUpOrCancel);
    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
    this.canvas.addEventListener("touchcancel", this.onTouchEnd, { passive: false });
  }

  consumeFrameInput(): CameraInputState {
    const snapshot: CameraInputState = {
      orbitDelta: this.orbitDelta,
      panDelta: this.panDelta,
      zoomDelta: this.zoomDelta,
      isInteracting: this.isInteracting
    };
    this.orbitDelta = [0, 0];
    this.panDelta = [0, 0];
    this.zoomDelta = 0;
    return snapshot;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.zoomDelta += event.deltaY / 600;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") {
      return;
    }
    this.activeMouseGesture = this.resolveMouseGesture(event);
    if (!this.activeMouseGesture) {
      return;
    }
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointerId = event.pointerId;
    this.lastPointerPos = { x: event.clientX, y: event.clientY };
    this.isInteracting = true;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.pointerId !== this.activePointerId || !this.lastPointerPos) {
      return;
    }
    const dx = event.clientX - this.lastPointerPos.x;
    const dy = event.clientY - this.lastPointerPos.y;
    this.lastPointerPos = { x: event.clientX, y: event.clientY };
    const [nx, ny] = normalizeCanvasDelta(dx, dy, this.canvas.clientWidth, this.canvas.clientHeight);
    if (this.activeMouseGesture === "pan") {
      this.panDelta = [this.panDelta[0] + nx, this.panDelta[1] + ny];
    } else if (this.activeMouseGesture === "orbit") {
      this.orbitDelta = [this.orbitDelta[0] + nx, this.orbitDelta[1] + ny];
    }
  };

  private readonly onPointerUpOrCancel = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.pointerId !== this.activePointerId) {
      return;
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.activePointerId = null;
    this.activeMouseGesture = null;
    this.lastPointerPos = null;
    this.isInteracting = this.touchPoints.size > 0;
  };

  private readonly onTouchStart = (event: TouchEvent): void => {
    event.preventDefault();
    this.syncTouchPoints(event.touches);
    this.isInteracting = this.touchPoints.size > 0;
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    event.preventDefault();
    const previous = new Map(this.touchPoints);
    this.syncTouchPoints(event.touches);
    const touches = [...this.touchPoints.values()];
    if (touches.length === 1) {
      const touch = touches[0];
      const previousTouch = previous.get([...this.touchPoints.keys()][0]);
      if (previousTouch) {
        const [nx, ny] = normalizeCanvasDelta(
          touch.x - previousTouch.x,
          touch.y - previousTouch.y,
          this.canvas.clientWidth,
          this.canvas.clientHeight
        );
        this.orbitDelta = [this.orbitDelta[0] + nx, this.orbitDelta[1] + ny];
      }
      this.lastTouchCenter = null;
      this.lastTouchDistance = 0;
      return;
    }

    if (touches.length >= 2) {
      const a = touches[0];
      const b = touches[1];
      const center: Point2D = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastTouchCenter) {
        const [nx, ny] = normalizeCanvasDelta(
          center.x - this.lastTouchCenter.x,
          center.y - this.lastTouchCenter.y,
          this.canvas.clientWidth,
          this.canvas.clientHeight
        );
        this.panDelta = [this.panDelta[0] + nx, this.panDelta[1] + ny];
      }
      if (this.lastTouchDistance > 0) {
        this.zoomDelta += (this.lastTouchDistance - distance) / 250;
      }
      this.lastTouchCenter = center;
      this.lastTouchDistance = distance;
    }
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    event.preventDefault();
    this.syncTouchPoints(event.touches);
    if (this.touchPoints.size < 2) {
      this.lastTouchCenter = null;
      this.lastTouchDistance = 0;
    }
    this.isInteracting = this.touchPoints.size > 0 || this.activePointerId !== null;
  };

  private syncTouchPoints(touches: TouchList): void {
    this.touchPoints.clear();
    for (let i = 0; i < touches.length; i += 1) {
      const touch = touches.item(i);
      if (touch) {
        this.touchPoints.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
    }
  }

  private resolveMouseGesture(event: PointerEvent): MouseGesture {
    if (event.button === 2 || (event.button === 0 && event.shiftKey)) {
      return "pan";
    }
    if (event.button === 0) {
      return "orbit";
    }
    return null;
  }
}
