import { ecefToLla, llaToEcef, lerp3, quatNormalize, quatSlerp } from "../math";
import type { FrameMessage, EntityState } from "../schema";

interface EntitySample {
  t: number;
  state: EntityState;
}

interface Range {
  start: number;
  end: number;
  duration: number;
}

export interface RuntimeEntityState extends EntityState {
  positionEcefM: [number, number, number];
}

export interface RuntimeFrameMessage {
  t: number;
  entities: RuntimeEntityState[];
  events?: NonNullable<FrameMessage["events"]>;
}

const cloneEntity = (state: EntityState): EntityState => ({
  ...state,
  pose: {
    positionLlaDegM: [...state.pose.positionLlaDegM] as [number, number, number],
    orientationBodyToNedQuat: [...state.pose.orientationBodyToNedQuat] as [number, number, number, number]
  },
  velocityEcef: state.velocityEcef ? [...state.velocityEcef] as [number, number, number] : undefined,
  metadata: state.metadata ? { ...state.metadata } : undefined
});

const upperBoundByTime = (samples: EntitySample[], t: number): number => {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (samples[mid].t <= t) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

const cloneRuntimeEntity = (state: EntityState): RuntimeEntityState => ({
  ...cloneEntity(state),
  positionEcefM: llaToEcef(state.pose.positionLlaDegM)
});

const interpolateEntityRuntime = (a: EntitySample, b: EntitySample, t: number): RuntimeEntityState => {
  if (a.t === b.t) {
    return cloneRuntimeEntity(a.state);
  }
  const alpha = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const posAEcef = llaToEcef(a.state.pose.positionLlaDegM);
  const posBEcef = llaToEcef(b.state.pose.positionLlaDegM);
  const posEcef = lerp3(posAEcef, posBEcef, alpha);
  const rot = quatSlerp(
    quatNormalize(a.state.pose.orientationBodyToNedQuat),
    quatNormalize(b.state.pose.orientationBodyToNedQuat),
    alpha
  );
  return {
    ...b.state,
    pose: {
      ...b.state.pose,
      orientationBodyToNedQuat: rot
    },
    positionEcefM: posEcef
  };
};

export class TimelineStore {
  private frames: FrameMessage[] = [];

  private entityIndex = new Map<string, EntitySample[]>();

  private eventIndex: NonNullable<FrameMessage["events"]> = [];

  setFrames(frames: FrameMessage[]): void {
    this.frames = [...frames].sort((a, b) => a.t - b.t);
    this.rebuildIndices();
  }

  appendFrame(frame: FrameMessage): void {
    this.frames.push(frame);
    this.frames.sort((a, b) => a.t - b.t);
    this.rebuildIndices();
  }

  getRange(): Range {
    if (this.frames.length === 0) {
      return { start: 0, end: 0, duration: 0 };
    }
    const start = this.frames[0].t;
    const end = this.frames[this.frames.length - 1].t;
    return { start, end, duration: end - start };
  }

  sampleAt(t: number): FrameMessage {
    const runtime = this.sampleAtRuntime(t);
    const entities: EntityState[] = runtime.entities.map((entity) => ({
      ...entity,
      pose: {
        ...entity.pose,
        positionLlaDegM: ecefToLla(entity.positionEcefM)
      }
    }));
    return {
      t,
      entities,
      events: this.eventsNear(t, 0.15)
    };
  }

  sampleAtRuntime(t: number): RuntimeFrameMessage {
    const entities: RuntimeEntityState[] = [];
    for (const samples of this.entityIndex.values()) {
      if (samples.length === 0) {
        continue;
      }
      const right = upperBoundByTime(samples, t);
      if (right <= 0) {
        entities.push(cloneRuntimeEntity(samples[0].state));
        continue;
      }
      if (right >= samples.length) {
        entities.push(cloneRuntimeEntity(samples[samples.length - 1].state));
        continue;
      }
      entities.push(interpolateEntityRuntime(samples[right - 1], samples[right], t));
    }
    return {
      t,
      entities,
      events: this.eventsNear(t, 0.15)
    };
  }

  eventsNear(t: number, halfWindowSec: number): NonNullable<FrameMessage["events"]> {
    if (this.eventIndex.length === 0) {
      return [];
    }
    const start = t - halfWindowSec;
    const end = t + halfWindowSec;
    return this.eventIndex.filter((event) => event.t >= start && event.t <= end);
  }

  private rebuildIndices(): void {
    this.entityIndex = new Map();
    this.eventIndex = [];
    for (const frame of this.frames) {
      for (const entity of frame.entities) {
        const list = this.entityIndex.get(entity.id);
        const sample = { t: frame.t, state: cloneEntity(entity) };
        if (!list) {
          this.entityIndex.set(entity.id, [sample]);
        } else {
          list.push(sample);
        }
      }
      if (frame.events) {
        this.eventIndex.push(...frame.events);
      }
    }
    for (const samples of this.entityIndex.values()) {
      samples.sort((a, b) => a.t - b.t);
    }
    this.eventIndex.sort((a, b) => a.t - b.t);
  }
}
