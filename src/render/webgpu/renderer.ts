import { ecefToWorld, llaToEcef, mat4LookAt, mat4Multiply, mat4Perspective } from "../../core/math";
import type { EntityState, FrameMessage } from "../../core/schema";
import { createGlobeGridPass, createSpritePass } from "../passes";
import type { RenderOptions, Renderer, SimulationContext } from "../types";
import { createInitialCameraState, updateCameraState } from "./camera";

const INITIAL_INSTANCE_BYTES = 64 * 1024;
const TRAIL_HISTORY = 48;

const asGpuSource = (data: Float32Array): GPUAllowSharedBufferSource => {
  if (data.buffer instanceof ArrayBuffer && data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer;
  }
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return bytes.buffer;
};

const domainColor = (entity: EntityState): [number, number, number, number] => {
  if (entity.kind === "weapon") {
    return [1.0, 0.42, 0.2, 0.95];
  }
  switch (entity.domain) {
    case "air":
      return [0.6, 1.0, 0.8, 0.95];
    case "ground":
      return [0.45, 0.9, 0.4, 0.95];
    case "sea":
      return [0.45, 0.78, 1.0, 0.95];
    case "space":
      return [1.0, 0.95, 0.65, 0.95];
  }
};

const instanceSize = (entity: EntityState): number => (entity.kind === "weapon" ? 0.0035 : 0.0055);
type WorldEntity = { entity: EntityState; world: [number, number, number] };
const distSq3 = (a: [number, number, number], b: [number, number, number]): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
};

export class WebGpuCombatRenderer implements Renderer {
  private readonly canvas: HTMLCanvasElement;

  private context: GPUCanvasContext | null = null;

  private device: GPUDevice | null = null;

  private format: GPUTextureFormat | null = null;

  private globePass: ReturnType<typeof createGlobeGridPass> | null = null;

  private spritePass: ReturnType<typeof createSpritePass> | null = null;

  private globeUniformBuffer: GPUBuffer | null = null;

  private spriteUniformBuffer: GPUBuffer | null = null;

  private globeBindGroup: GPUBindGroup | null = null;

  private spriteBindGroup: GPUBindGroup | null = null;

  private entityInstanceBuffer: GPUBuffer | null = null;

  private trailInstanceBuffer: GPUBuffer | null = null;

  private eventInstanceBuffer: GPUBuffer | null = null;

  private entityInstanceCapacityBytes = 0;

  private trailInstanceCapacityBytes = 0;

  private eventInstanceCapacityBytes = 0;

  private depthTexture: GPUTexture | null = null;

  private cameraState = createInitialCameraState();

  private trails = new Map<string, [number, number, number][]>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  isReady(): boolean {
    return Boolean(this.device && this.context && this.format);
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU unsupported in this browser.");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No WebGPU adapter available.");
    }
    const device = await adapter.requestDevice();
    const context = this.canvas.getContext("webgpu") as GPUCanvasContext | null;
    if (!context) {
      throw new Error("Failed to acquire WebGPU canvas context.");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();

    this.device = device;
    this.context = context;
    this.format = format;

    this.configureContext();
    this.createPasses();
    this.createUniforms();
    this.createInstanceBuffers();
    this.resize(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
  }

  resize(width: number, height: number): void {
    if (!this.device || !this.context) {
      return;
    }
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.createDepthTexture(w, h);
  }

  render(frame: FrameMessage, dtSec: number, options: RenderOptions, simContext: SimulationContext): void {
    if (!this.device || !this.context || !this.format || !this.globePass || !this.spritePass) {
      return;
    }

    const worldEntities = this.toWorldEntities(frame.entities);
    const entityLockTarget = this.resolveEntityLockTarget(worldEntities, simContext.cameraTargetEntityId);
    this.cameraState = updateCameraState(this.cameraState, {
      mode: simContext.cameraMode,
      dtSec,
      input: simContext.userInput,
      presetRequest: simContext.cameraPresetRequest,
      entityLockTarget
    });
    const aspect = this.canvas.width / this.canvas.height;
    const projection = mat4Perspective((50 * Math.PI) / 180, aspect, 0.01, 100);
    const view = mat4LookAt(this.cameraState.eye, this.cameraState.target, this.cameraState.up);
    const viewProj = mat4Multiply(projection, view);

    this.writeUniforms(viewProj);

    const entityData = this.buildEntityInstances(worldEntities);
    const trailData = this.buildTrailInstances(worldEntities);
    const eventData = this.buildEventInstances(frame);

    this.writeInstanceData("entity", entityData);
    this.writeInstanceData("trail", trailData);
    this.writeInstanceData("event", eventData);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.07, b: 0.03, a: 1.0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ],
      depthStencilAttachment: this.depthTexture
        ? {
            view: this.depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store"
          }
        : undefined
    });

    if (options.showGrid) {
      pass.setPipeline(this.globePass.pipeline);
      pass.setBindGroup(0, this.globeBindGroup!);
      pass.setVertexBuffer(0, this.globePass.vertexBuffer);
      pass.draw(this.globePass.vertexCount, 1, 0, 0);
    }

    pass.setPipeline(this.spritePass.pipeline);
    pass.setBindGroup(0, this.spriteBindGroup!);
    pass.setVertexBuffer(0, this.spritePass.cornerBuffer);

    if (options.showTrails && trailData.length > 0) {
      pass.setVertexBuffer(1, this.trailInstanceBuffer!);
      pass.draw(this.spritePass.cornerVertexCount, trailData.length / 8, 0, 0);
    }

    if (entityData.length > 0) {
      pass.setVertexBuffer(1, this.entityInstanceBuffer!);
      pass.draw(this.spritePass.cornerVertexCount, entityData.length / 8, 0, 0);
    }

    if (options.showEvents && eventData.length > 0) {
      pass.setVertexBuffer(1, this.eventInstanceBuffer!);
      pass.draw(this.spritePass.cornerVertexCount, eventData.length / 8, 0, 0);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private configureContext(): void {
    if (!this.device || !this.context || !this.format) {
      return;
    }
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied"
    });
  }

  private createPasses(): void {
    if (!this.device || !this.format) {
      return;
    }
    this.globePass = createGlobeGridPass(this.device, this.format);
    this.spritePass = createSpritePass(this.device, this.format);
  }

  private createUniforms(): void {
    if (!this.device || !this.globePass || !this.spritePass) {
      return;
    }
    this.globeUniformBuffer = this.device.createBuffer({
      size: (16 + 4) * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.spriteUniformBuffer = this.device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.globeBindGroup = this.device.createBindGroup({
      layout: this.globePass.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.globeUniformBuffer } }]
    });
    this.spriteBindGroup = this.device.createBindGroup({
      layout: this.spritePass.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.spriteUniformBuffer } }]
    });
  }

  private createInstanceBuffers(): void {
    if (!this.device) {
      return;
    }
    this.entityInstanceBuffer = this.device.createBuffer({
      size: INITIAL_INSTANCE_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.trailInstanceBuffer = this.device.createBuffer({
      size: INITIAL_INSTANCE_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.eventInstanceBuffer = this.device.createBuffer({
      size: INITIAL_INSTANCE_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.entityInstanceCapacityBytes = INITIAL_INSTANCE_BYTES;
    this.trailInstanceCapacityBytes = INITIAL_INSTANCE_BYTES;
    this.eventInstanceCapacityBytes = INITIAL_INSTANCE_BYTES;
  }

  private createDepthTexture(width: number, height: number): void {
    if (!this.device) {
      return;
    }
    this.depthTexture?.destroy();
    this.depthTexture = this.device.createTexture({
      size: { width, height },
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  private writeUniforms(viewProj: Float32Array): void {
    if (!this.device || !this.globeUniformBuffer || !this.spriteUniformBuffer) {
      return;
    }
    const globeData = new Float32Array(20);
    globeData.set(viewProj, 0);
    globeData.set([0.52, 0.98, 0.62, 0.7], 16);
    this.device.queue.writeBuffer(this.globeUniformBuffer, 0, asGpuSource(globeData));
    this.device.queue.writeBuffer(this.spriteUniformBuffer, 0, asGpuSource(viewProj));
  }

  private buildEntityInstances(worldEntities: WorldEntity[]): Float32Array {
    const data = new Float32Array(worldEntities.length * 8);
    let i = 0;
    for (const { entity, world } of worldEntities) {
      const color = domainColor(entity);
      data.set([world[0], world[1], world[2], instanceSize(entity), color[0], color[1], color[2], color[3]], i);
      i += 8;
    }
    return data;
  }

  private buildTrailInstances(worldEntities: WorldEntity[]): Float32Array {
    for (const { entity, world } of worldEntities) {
      const history = this.trails.get(entity.id) ?? [];
      history.push(world);
      if (history.length > TRAIL_HISTORY) {
        history.splice(0, history.length - TRAIL_HISTORY);
      }
      this.trails.set(entity.id, history);
    }

    const out: number[] = [];
    for (const { entity } of worldEntities) {
      const history = this.trails.get(entity.id);
      if (!history) {
        continue;
      }
      const [r, g, b] = domainColor(entity);
      for (let i = 0; i < history.length; i += 2) {
        const alpha = (i + 1) / history.length;
        const point = history[i];
        out.push(point[0], point[1], point[2], 0.0018, r, g, b, alpha * 0.3);
      }
    }
    return new Float32Array(out);
  }

  private buildEventInstances(frame: FrameMessage): Float32Array {
    const out: number[] = [];
    for (const event of frame.events ?? []) {
      const world = ecefToWorld(llaToEcef(event.positionLlaDegM));
      const color =
        event.type === "launch"
          ? [1.0, 0.78, 0.22, 0.95]
          : event.type === "intercept"
            ? [1.0, 0.2, 0.2, 0.95]
            : [1.0, 0.52, 0.28, 0.95];
      out.push(world[0], world[1], world[2], 0.009, color[0], color[1], color[2], color[3]);
    }
    return new Float32Array(out);
  }

  private toWorldEntities(entities: EntityState[]): WorldEntity[] {
    return entities.map((entity) => ({
      entity,
      world: ecefToWorld(llaToEcef(entity.pose.positionLlaDegM))
    }));
  }

  private resolveEntityLockTarget(
    worldEntities: WorldEntity[],
    targetEntityId: string | undefined
  ): [number, number, number] | null {
    if (worldEntities.length === 0) {
      return null;
    }
    if (targetEntityId) {
      const direct = worldEntities.find((item) => item.entity.id === targetEntityId);
      if (direct) {
        return direct.world;
      }
    }
    let best = worldEntities[0];
    let bestDistance = distSq3(best.world, this.cameraState.target);
    for (let i = 1; i < worldEntities.length; i += 1) {
      const candidate = worldEntities[i];
      const d = distSq3(candidate.world, this.cameraState.target);
      if (d < bestDistance) {
        bestDistance = d;
        best = candidate;
      }
    }
    return best.world;
  }

  private writeInstanceData(kind: "entity" | "trail" | "event", data: Float32Array): void {
    if (!this.device) {
      return;
    }
    const bytes = Math.max(4, data.byteLength);
    if (kind === "entity") {
      if (!this.entityInstanceBuffer || bytes > this.entityInstanceCapacityBytes) {
        this.entityInstanceCapacityBytes = Math.max(bytes, this.entityInstanceCapacityBytes * 2);
        this.entityInstanceBuffer = this.device.createBuffer({
          size: this.entityInstanceCapacityBytes,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
      }
      if (data.byteLength > 0) {
        this.device.queue.writeBuffer(this.entityInstanceBuffer, 0, asGpuSource(data));
      }
      return;
    }
    if (kind === "trail") {
      if (!this.trailInstanceBuffer || bytes > this.trailInstanceCapacityBytes) {
        this.trailInstanceCapacityBytes = Math.max(bytes, this.trailInstanceCapacityBytes * 2);
        this.trailInstanceBuffer = this.device.createBuffer({
          size: this.trailInstanceCapacityBytes,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
      }
      if (data.byteLength > 0) {
        this.device.queue.writeBuffer(this.trailInstanceBuffer, 0, asGpuSource(data));
      }
      return;
    }
    if (!this.eventInstanceBuffer || bytes > this.eventInstanceCapacityBytes) {
      this.eventInstanceCapacityBytes = Math.max(bytes, this.eventInstanceCapacityBytes * 2);
      this.eventInstanceBuffer = this.device.createBuffer({
        size: this.eventInstanceCapacityBytes,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
    }
    if (data.byteLength > 0) {
      this.device.queue.writeBuffer(this.eventInstanceBuffer, 0, asGpuSource(data));
    }
  }
}
