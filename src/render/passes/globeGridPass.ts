import { llaToEcef, WGS84_A, WGS84_B } from "../../core/math";

const globeShader = /* wgsl */ `
struct Globals {
  view_proj : mat4x4<f32>,
  color : vec4<f32>,
};

@group(0) @binding(0)
var<uniform> globals : Globals;

struct VsOut {
  @builtin(position) position : vec4<f32>,
};

@vertex
fn vs_main(@location(0) position: vec3<f32>) -> VsOut {
  var out : VsOut;
  out.position = globals.view_proj * vec4<f32>(position, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return globals.color;
}
`;

const toWorld = (ecef: [number, number, number]): [number, number, number] => [
  ecef[0] / WGS84_A,
  ecef[1] / WGS84_A,
  ecef[2] / WGS84_B
];

const pushLine = (out: number[], a: [number, number, number], b: [number, number, number]): void => {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
};

const asGpuSource = (data: Float32Array): GPUAllowSharedBufferSource => {
  if (data.buffer instanceof ArrayBuffer && data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer;
  }
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return bytes.buffer;
};

const generateGridVertices = (): Float32Array => {
  const vertices: number[] = [];
  const latStep = 10;
  const lonStep = 10;

  for (let lat = -80; lat <= 80; lat += latStep) {
    for (let lon = -180; lon < 180; lon += lonStep) {
      const p0 = toWorld(llaToEcef([lat, lon, 0]));
      const p1 = toWorld(llaToEcef([lat, lon + lonStep, 0]));
      pushLine(vertices, p0, p1);
    }
  }

  for (let lon = -180; lon <= 180; lon += lonStep) {
    for (let lat = -90; lat < 90; lat += latStep) {
      const p0 = toWorld(llaToEcef([lat, lon, 0]));
      const p1 = toWorld(llaToEcef([lat + latStep, lon, 0]));
      pushLine(vertices, p0, p1);
    }
  }

  return new Float32Array(vertices);
};

export interface GlobeGridPass {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  vertexBuffer: GPUBuffer;
  vertexCount: number;
}

export const createGlobeGridPass = (device: GPUDevice, format: GPUTextureFormat): GlobeGridPass => {
  const module = device.createShaderModule({ code: globeShader });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 3 * 4,
          stepMode: "vertex",
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }]
        }
      ]
    },
    fragment: {
      module,
      entryPoint: "fs_main",
      targets: [{ format }]
    },
    primitive: {
      topology: "line-list",
      cullMode: "none"
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less"
    }
  });

  const vertices = generateGridVertices();
  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(vertexBuffer, 0, asGpuSource(vertices));

  return {
    pipeline,
    bindGroupLayout,
    vertexBuffer,
    vertexCount: vertices.length / 3
  };
};
