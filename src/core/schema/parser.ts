import type {
  CombatEvent,
  CombatEventType,
  Domain,
  EntityKind,
  EntityState,
  FrameMessage,
  PoseSample,
  SessionHeader
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const ensureRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
};

const ensureFiniteNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be numeric`);
  }
  return value;
};

const ensureNonEmptyString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
};

const ensureString = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
  return value;
};

const ensureTuple3 = (value: unknown, path: string): [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${path} must be a 3-tuple`);
  }
  const a = ensureFiniteNumber(value[0], `${path}[0]`);
  const b = ensureFiniteNumber(value[1], `${path}[1]`);
  const c = ensureFiniteNumber(value[2], `${path}[2]`);
  return [a, b, c];
};

const ensureTuple4 = (value: unknown, path: string): [number, number, number, number] => {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(`${path} must be a 4-tuple`);
  }
  const a = ensureFiniteNumber(value[0], `${path}[0]`);
  const b = ensureFiniteNumber(value[1], `${path}[1]`);
  const c = ensureFiniteNumber(value[2], `${path}[2]`);
  const d = ensureFiniteNumber(value[3], `${path}[3]`);
  return [a, b, c, d];
};

const ensureEntityKind = (value: unknown, path: string): EntityKind => {
  if (value === "platform" || value === "weapon") {
    return value;
  }
  throw new Error(`${path} must be platform|weapon`);
};

const ensureDomain = (value: unknown, path: string): Domain => {
  if (value === "air" || value === "ground" || value === "sea" || value === "space") {
    return value;
  }
  throw new Error(`${path} must be air|ground|sea|space`);
};

const ensureCombatEventType = (value: unknown, path: string): CombatEventType => {
  if (value === "launch" || value === "impact" || value === "intercept") {
    return value;
  }
  throw new Error(`${path} must be launch|impact|intercept`);
};

const parsePose = (raw: unknown, path: string): PoseSample => {
  const obj = ensureRecord(raw, path);
  return {
    positionLlaDegM: ensureTuple3(obj.positionLlaDegM, `${path}.positionLlaDegM`),
    orientationBodyToNedQuat: ensureTuple4(obj.orientationBodyToNedQuat, `${path}.orientationBodyToNedQuat`)
  };
};

const parseMetadata = (value: unknown, path: string): Record<string, string | number | boolean> => {
  const obj = ensureRecord(value, path);
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" || typeof v === "boolean") {
      out[k] = v;
      continue;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
      continue;
    }
    throw new Error(`${path}.${k} must be string|number|boolean`);
  }
  return out;
};

const parseEntity = (raw: unknown, path: string): EntityState => {
  const obj = ensureRecord(raw, path);
  const velocity = obj.velocityEcef === undefined ? undefined : ensureTuple3(obj.velocityEcef, `${path}.velocityEcef`);
  const metadata = obj.metadata === undefined ? undefined : parseMetadata(obj.metadata, `${path}.metadata`);

  return {
    id: ensureNonEmptyString(obj.id, `${path}.id`),
    kind: ensureEntityKind(obj.kind, `${path}.kind`),
    domain: ensureDomain(obj.domain, `${path}.domain`),
    modelId: ensureNonEmptyString(obj.modelId, `${path}.modelId`),
    pose: parsePose(obj.pose, `${path}.pose`),
    velocityEcef: velocity,
    metadata
  };
};

const parseEvent = (raw: unknown, path: string): CombatEvent => {
  const obj = ensureRecord(raw, path);
  return {
    id: ensureNonEmptyString(obj.id, `${path}.id`),
    type: ensureCombatEventType(obj.type, `${path}.type`),
    sourceId: obj.sourceId === undefined ? undefined : ensureString(obj.sourceId, `${path}.sourceId`),
    targetId: obj.targetId === undefined ? undefined : ensureString(obj.targetId, `${path}.targetId`),
    positionLlaDegM: ensureTuple3(obj.positionLlaDegM, `${path}.positionLlaDegM`),
    t: ensureFiniteNumber(obj.t, `${path}.t`)
  };
};

export const parseSessionHeader = (raw: unknown): SessionHeader => {
  const obj = ensureRecord(raw, "header");
  if (obj.protocolVersion !== "1.0") {
    throw new Error('header.protocolVersion must be "1.0"');
  }
  if (obj.scenarioId !== undefined && typeof obj.scenarioId !== "string") {
    throw new Error("header.scenarioId must be string");
  }
  return {
    protocolVersion: "1.0",
    scenarioId: obj.scenarioId as string | undefined
  };
};

export const parseFrameMessage = (raw: unknown): FrameMessage => {
  const obj = ensureRecord(raw, "frame");
  if (!Array.isArray(obj.entities)) {
    throw new Error("frame.entities must be an array");
  }
  if (obj.events !== undefined && !Array.isArray(obj.events)) {
    throw new Error("frame.events must be an array when provided");
  }
  const entities = (obj.entities as unknown[]).map((entity, i) => parseEntity(entity, `frame.entities[${i}]`));
  const events =
    obj.events === undefined
      ? undefined
      : (obj.events as unknown[]).map((event, i) => parseEvent(event, `frame.events[${i}]`));

  return {
    t: ensureFiniteNumber(obj.t, "frame.t"),
    entities,
    events
  };
};

export const tryParseFrameMessage = (raw: unknown): { ok: true; value: FrameMessage } | { ok: false; error: Error } => {
  try {
    return { ok: true, value: parseFrameMessage(raw) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
};
