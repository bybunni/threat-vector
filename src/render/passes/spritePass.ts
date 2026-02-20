const spriteShader = /* wgsl */ `
struct Globals {
  view_proj : mat4x4<f32>,
};

@group(0) @binding(0)
var<uniform> globals : Globals;

struct VsOut {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec4<f32>,
};

@vertex
fn vs_main(
  @location(0) corner: vec2<f32>,
  @location(1) posSize: vec4<f32>,
  @location(2) sizeMode: f32,
  @location(3) color: vec4<f32>
) -> VsOut {
  let world = vec4<f32>(posSize.xyz, 1.0);
  let clip = globals.view_proj * world;
  let clipW = max(1e-6, abs(clip.w));
  let depthSizeNdc = clamp(posSize.w / clipW, 0.00035, 0.07);
  let depthOffset = corner * depthSizeNdc * clip.w;
  let screenOffset = corner * posSize.w * clip.w;
  let offset = select(depthOffset, screenOffset, sizeMode > 0.5);

  var out : VsOut;
  out.position = vec4<f32>(clip.xy + offset, clip.zw);
  out.color = color;
  return out;
}

@fragment
fn fs_main(@location(0) color : vec4<f32>) -> @location(0) vec4<f32> {
  return color;
}
`;

export interface SpritePass {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  cornerBuffer: GPUBuffer;
  cornerVertexCount: number;
}

export const createSpritePass = (device: GPUDevice, format: GPUTextureFormat): SpritePass => {
  const module = device.createShaderModule({ code: spriteShader });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
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
          arrayStride: 2 * 4,
          stepMode: "vertex",
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }]
        },
        {
          arrayStride: 9 * 4,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x4" },
            { shaderLocation: 2, offset: 4 * 4, format: "float32" },
            { shaderLocation: 3, offset: 5 * 4, format: "float32x4" }
          ]
        }
      ]
    },
    fragment: {
      module,
      entryPoint: "fs_main",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none"
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less"
    }
  });

  const corners = new Float32Array([
    -1, -1, //
    1, -1, //
    0, 1
  ]);
  const cornerBuffer = device.createBuffer({
    size: corners.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(cornerBuffer, 0, corners);

  return {
    pipeline,
    bindGroupLayout,
    cornerBuffer,
    cornerVertexCount: 3
  };
};
