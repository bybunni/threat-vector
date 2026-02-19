export type Domain = "air" | "ground" | "sea" | "space";
export type EntityKind = "platform" | "weapon";
export type CombatEventType = "launch" | "impact" | "intercept";

export type TimeSeconds = number;

export interface SessionHeader {
  protocolVersion: "1.0";
  scenarioId?: string;
}

export interface PoseSample {
  positionLlaDegM: [latDeg: number, lonDeg: number, altM: number];
  orientationBodyToNedQuat: [x: number, y: number, z: number, w: number];
}

export interface EntityState {
  id: string;
  kind: EntityKind;
  domain: Domain;
  modelId: string;
  pose: PoseSample;
  velocityEcef?: [number, number, number];
  metadata?: Record<string, string | number | boolean>;
}

export interface CombatEvent {
  id: string;
  type: CombatEventType;
  sourceId?: string;
  targetId?: string;
  positionLlaDegM: [number, number, number];
  t: TimeSeconds;
}

export interface FrameMessage {
  t: TimeSeconds;
  entities: EntityState[];
  events?: CombatEvent[];
}
