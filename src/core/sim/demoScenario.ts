import type { CombatEvent, EntityState, FrameMessage } from "../schema";

interface TrackDef {
  id: string;
  kind: EntityState["kind"];
  domain: EntityState["domain"];
  modelId: string;
  baseLat: number;
  baseLon: number;
  baseAlt: number;
  dLat: number;
  dLon: number;
  dAlt: number;
  periodSec: number;
  phase: number;
}

const yawQuat = (yawRad: number): [number, number, number, number] => {
  const h = yawRad / 2;
  return [0, 0, Math.sin(h), Math.cos(h)];
};

const trackDefs: TrackDef[] = [
  {
    id: "air-eagle-01",
    kind: "platform",
    domain: "air",
    modelId: "f16_faceted",
    baseLat: 34.2,
    baseLon: -116.3,
    baseAlt: 10000,
    dLat: 1.6,
    dLon: 2.4,
    dAlt: 2200,
    periodSec: 180,
    phase: 0.2
  },
  {
    id: "air-tanker-02",
    kind: "platform",
    domain: "air",
    modelId: "kc135_faceted",
    baseLat: 35.4,
    baseLon: -118.0,
    baseAlt: 11000,
    dLat: 1.2,
    dLon: 1.1,
    dAlt: 1200,
    periodSec: 260,
    phase: 1.1
  },
  {
    id: "sea-frigate-01",
    kind: "platform",
    domain: "sea",
    modelId: "frigate_faceted",
    baseLat: 22.8,
    baseLon: -158.5,
    baseAlt: 0,
    dLat: 0.8,
    dLon: 1.8,
    dAlt: 0,
    periodSec: 520,
    phase: 0.4
  },
  {
    id: "ground-convoy-01",
    kind: "platform",
    domain: "ground",
    modelId: "convoy_faceted",
    baseLat: 36.1,
    baseLon: -115.2,
    baseAlt: 900,
    dLat: 0.4,
    dLon: 0.7,
    dAlt: 40,
    periodSec: 640,
    phase: 0.7
  },
  {
    id: "space-sat-01",
    kind: "platform",
    domain: "space",
    modelId: "satellite_faceted",
    baseLat: 0,
    baseLon: -30,
    baseAlt: 410000,
    dLat: 52,
    dLon: 170,
    dAlt: 5000,
    periodSec: 560,
    phase: 2.1
  }
];

const buildTrackEntity = (track: TrackDef, t: number): EntityState => {
  const omega = (2 * Math.PI) / track.periodSec;
  const arg = omega * t + track.phase;
  const lat = track.baseLat + Math.sin(arg) * track.dLat;
  const lon = track.baseLon + Math.cos(arg * 0.7) * track.dLon;
  const alt = track.baseAlt + Math.sin(arg * 1.3) * track.dAlt;
  const yaw = Math.atan2(Math.cos(arg * 0.7) * track.dLon, Math.cos(arg) * track.dLat);
  return {
    id: track.id,
    kind: track.kind,
    domain: track.domain,
    modelId: track.modelId,
    pose: {
      positionLlaDegM: [lat, lon, Math.max(0, alt)],
      orientationBodyToNedQuat: yawQuat(yaw)
    }
  };
};

const missileState = (t: number): EntityState | null => {
  const launchT = 40;
  const impactT = 125;
  if (t < launchT || t > impactT) {
    return null;
  }
  const alpha = (t - launchT) / (impactT - launchT);
  const start: [number, number, number] = [34.7, -116.2, 10200];
  const end: [number, number, number] = [23.1, -157.6, 100];
  const lat = start[0] + (end[0] - start[0]) * alpha + Math.sin(alpha * Math.PI) * 3.8;
  const lon = start[1] + (end[1] - start[1]) * alpha;
  const alt = start[2] + (end[2] - start[2]) * alpha + Math.sin(alpha * Math.PI) * 18000;
  const yaw = Math.atan2(end[1] - start[1], end[0] - start[0]);
  return {
    id: "weapon-missile-01",
    kind: "weapon",
    domain: "air",
    modelId: "aam_faceted",
    pose: {
      positionLlaDegM: [lat, lon, alt],
      orientationBodyToNedQuat: yawQuat(yaw)
    }
  };
};

export const generateDemoScenario = (durationSec = 240, stepSec = 0.2): FrameMessage[] => {
  const frames: FrameMessage[] = [];
  for (let t = 0; t <= durationSec + 1e-6; t += stepSec) {
    const entities = trackDefs.map((track) => buildTrackEntity(track, t));
    const missile = missileState(t);
    if (missile) {
      entities.push(missile);
    }
    const events: CombatEvent[] = [];
    if (Math.abs(t - 40) < stepSec * 0.5) {
      events.push({
        id: "launch-weapon-missile-01",
        type: "launch" as const,
        sourceId: "air-eagle-01",
        positionLlaDegM: [34.7, -116.2, 10200] as [number, number, number],
        t
      });
    }
    if (Math.abs(t - 125) < stepSec * 0.5) {
      events.push({
        id: "impact-weapon-missile-01",
        type: "impact" as const,
        sourceId: "weapon-missile-01",
        targetId: "sea-frigate-01",
        positionLlaDegM: [23.1, -157.6, 0] as [number, number, number],
        t
      });
    }
    frames.push({
      t,
      entities,
      events
    });
  }
  return frames;
};
