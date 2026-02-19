# Threat Vector

Threat Vector is a browser-native WebGPU combat visualizer with a retro-future style:

- WGS84 ellipsoid globe with phosphor green vector grid
- Hybrid vector + faceted object rendering for air/ground/sea/space
- Time-series playback with scrubbing and time scale controls
- Coordinate frame math for `LLA`, `ECEF`, `NED`, and `Body (FRD)`
- ECEF-authoritative playback semantics (no implicit Earth spin in default mode)

## Quickstart

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Data Contract (v1.0)

Frame messages are JSON objects:

```json
{
  "t": 12.5,
  "entities": [
    {
      "id": "air-1",
      "kind": "platform",
      "domain": "air",
      "modelId": "f16_faceted",
      "pose": {
        "positionLlaDegM": [34.1, -117.3, 10000],
        "orientationBodyToNedQuat": [0, 0, 0, 1]
      }
    }
  ],
  "events": [
    {
      "id": "launch-1",
      "type": "launch",
      "sourceId": "air-1",
      "positionLlaDegM": [34.1, -117.3, 10000],
      "t": 12.5
    }
  ]
}
```

## Architecture

- `src/core/math`: geodesy + frame transforms
- `src/core/schema`: runtime validation and protocol types
- `src/core/sim`: timeline indexing/interpolation + demo scenario
- `src/render/webgpu`: WebGPU renderer and passes
- `src/io`: NDJSON/JSON parsing and websocket client
- `src/ui`: HUD controls

## OBJ -> GLB Pipeline

Use `scripts/convert-obj-to-glb.sh` to preprocess assets:

```bash
scripts/convert-obj-to-glb.sh path/to/model.obj public/assets/models/model.glb
```

The script expects `obj2gltf` and either `gltf-transform` or `gltf-pipeline`.

## Tests

```bash
npm test
```

The test suite covers geodesy transforms, schema validation, and timeline interpolation behavior.

## Frame Semantics

- `Frame Model: ECEF` is the default authoritative mode.
- Camera defaults to `Static` tactical framing to avoid false Earth-rotation perception.
- Incoming platform/weapon data is treated as already rotation-accounted in Earth-fixed coordinates.
