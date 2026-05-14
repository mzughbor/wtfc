import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GPUComputationRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/misc/GPUComputationRenderer.js';
import { SimplexNoise } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/math/SimplexNoise.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/RGBELoader.js';

const WATER_HDR_PATH = '/static/assets/water/blouberg_sunrise_2_1k.hdr';
const WATER_DUCK_PATH = '/static/assets/water/duck.glb';
const WIDTH = 128;
export const WATER_BOUNDS = 20;
const BOUNDS = WATER_BOUNDS;
const BOUNDS_HALF = BOUNDS * 0.5;
export const WATER_CAMERA_DISTANCE = BOUNDS * (4 / 6);
const NUM_DUCK = 12;

const readWaterLevelFragmentShader = /* glsl */`
  uniform vec2 point1;
  uniform sampler2D levelTexture;

  float shift_right(float v, float amt) {
    v = floor(v) + 0.5;
    return floor(v / exp2(amt));
  }

  float shift_left(float v, float amt) {
    return floor(v * exp2(amt) + 0.5);
  }

  float mask_last(float v, float bits) {
    return mod(v, shift_left(1.0, bits));
  }

  float extract_bits(float num, float from, float to) {
    from = floor(from + 0.5);
    to = floor(to + 0.5);
    return mask_last(shift_right(num, from), to - from);
  }

  vec4 encode_float(float val) {
    if (val == 0.0) return vec4(0.0, 0.0, 0.0, 0.0);
    float sign = val > 0.0 ? 0.0 : 1.0;
    val = abs(val);
    float exponent = floor(log2(val));
    float biased_exponent = exponent + 127.0;
    float fraction = ((val / exp2(exponent)) - 1.0) * 8388608.0;
    float t = biased_exponent / 2.0;
    float last_bit_of_biased_exponent = fract(t) * 2.0;
    float remaining_bits_of_biased_exponent = floor(t);
    float byte4 = extract_bits(fraction, 0.0, 8.0) / 255.0;
    float byte3 = extract_bits(fraction, 8.0, 16.0) / 255.0;
    float byte2 = (last_bit_of_biased_exponent * 128.0 + extract_bits(fraction, 16.0, 23.0)) / 255.0;
    float byte1 = (sign * 128.0 + remaining_bits_of_biased_exponent) / 255.0;
    return vec4(byte4, byte3, byte2, byte1);
  }

  void main() {
    vec2 cellSize = 1.0 / resolution.xy;
    float waterLevel = texture2D(levelTexture, point1).x;
    vec2 normal = vec2(
      (texture2D(levelTexture, point1 + vec2(-cellSize.x, 0.0)).x - texture2D(levelTexture, point1 + vec2(cellSize.x, 0.0)).x) * WIDTH / BOUNDS,
      (texture2D(levelTexture, point1 + vec2(0.0, -cellSize.y)).x - texture2D(levelTexture, point1 + vec2(0.0, cellSize.y)).x) * WIDTH / BOUNDS
    );

    if (gl_FragCoord.x < 1.5) {
      gl_FragColor = encode_float(waterLevel);
    } else if (gl_FragCoord.x < 2.5) {
      gl_FragColor = encode_float(normal.x);
    } else if (gl_FragCoord.x < 3.5) {
      gl_FragColor = encode_float(normal.y);
    } else {
      gl_FragColor = encode_float(0.0);
    }
  }
`;

const shaderChange = {
  heightmap_frag: /* glsl */`
    #include <common>

    uniform vec2 mousePos;
    uniform float mouseSize;
    uniform float viscosity;
    uniform float deep;

    void main() {
      vec2 cellSize = 1.0 / resolution.xy;
      vec2 uv = gl_FragCoord.xy * cellSize;
      vec4 heightmapValue = texture2D(heightmap, uv);
      vec4 north = texture2D(heightmap, uv + vec2(0.0, cellSize.y));
      vec4 south = texture2D(heightmap, uv + vec2(0.0, -cellSize.y));
      vec4 east = texture2D(heightmap, uv + vec2(cellSize.x, 0.0));
      vec4 west = texture2D(heightmap, uv + vec2(-cellSize.x, 0.0));
      float newHeight = ((north.x + south.x + east.x + west.x) * 0.5 - heightmapValue.y) * viscosity;
      float mousePhase = clamp(
        length((uv - vec2(0.5)) * BOUNDS - vec2(mousePos.x, -mousePos.y)) * PI / mouseSize,
        0.0,
        PI
      );
      newHeight -= (cos(mousePhase) + 1.0) * deep;
      heightmapValue.y = heightmapValue.x;
      heightmapValue.x = newHeight;
      gl_FragColor = heightmapValue;
    }
  `,
  common: /* glsl */`
    #include <common>
    uniform sampler2D heightmap;
  `,
  beginnormal_vertex: /* glsl */`
    vec2 cellSize = vec2(1.0 / WIDTH, 1.0 / WIDTH);
    vec3 objectNormal = vec3(
      (texture2D(heightmap, uv + vec2(-cellSize.x, 0.0)).x - texture2D(heightmap, uv + vec2(cellSize.x, 0.0)).x) * WIDTH / BOUNDS,
      (texture2D(heightmap, uv + vec2(0.0, -cellSize.y)).x - texture2D(heightmap, uv + vec2(0.0, cellSize.y)).x) * WIDTH / BOUNDS,
      1.0
    );
    #ifdef USE_TANGENT
      vec3 objectTangent = vec3(tangent.xyz);
    #endif
  `,
  begin_vertex: /* glsl */`
    float heightValue = texture2D(heightmap, uv).x;
    vec3 transformed = vec3(position.x, position.y, heightValue);
    #ifdef USE_ALPHAHASH
      vPosition = vec3(position);
    #endif
  `,
};

class WaterMaterial extends THREE.MeshStandardMaterial {
  constructor(parameters) {
    super();
    this.defines = {
      STANDARD: '',
      USE_UV: '',
      WIDTH: WIDTH.toFixed(1),
      BOUNDS: BOUNDS.toFixed(1),
    };
    this.extra = {};
    this.addParameter('heightmap', null);
    this.setValues(parameters);
  }

  addParameter(name, value) {
    this.extra[name] = value;
    Object.defineProperty(this, name, {
      get: () => this.extra[name],
      set: (nextValue) => {
        this.extra[name] = nextValue;
        if (this.userData.shader) {
          this.userData.shader.uniforms[name].value = this.extra[name];
        }
      },
    });
  }

  onBeforeCompile(shader) {
    Object.keys(this.extra).forEach((name) => {
      shader.uniforms[name] = { value: this.extra[name] };
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', shaderChange.common);
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', shaderChange.beginnormal_vertex);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', shaderChange.begin_vertex);
    this.userData.shader = shader;
  }
}

function fillTexture(texture, simplex) {
  const waterMaxHeight = 0.1;

  function noise(x, y) {
    let multR = waterMaxHeight;
    let mult = 0.025;
    let value = 0;
    for (let i = 0; i < 15; i += 1) {
      value += multR * simplex.noise(x * mult, y * mult);
      multR *= 0.53 + 0.025 * i;
      mult *= 1.25;
    }
    return value;
  }

  const pixels = texture.image.data;
  let p = 0;
  for (let j = 0; j < WIDTH; j += 1) {
    for (let i = 0; i < WIDTH; i += 1) {
      const x = (i * 128) / WIDTH;
      const y = (j * 128) / WIDTH;
      const height = noise(x, y);
      pixels[p] = height;
      pixels[p + 1] = height;
      pixels[p + 2] = 0;
      pixels[p + 3] = 1;
      p += 4;
    }
  }
}

export function createWaterChapter(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;
  return group;
}

export async function initWaterChapter(renderer, chapterGroup) {
  const simplex = new SimplexNoise();
  const tmpQuat = new THREE.Quaternion();
  const tmpQuatX = new THREE.Quaternion();
  const tmpQuatZ = new THREE.Quaternion();
  const waterNormal = new THREE.Vector3();
  const ducks = [];
  let tmpHeightmap = null;
  let frame = 0;
  const simulationSpeed = 5;

  const sun = new THREE.DirectionalLight(0xffffff, 4.0);
  sun.position.set(-1, 2.6, 1.4);
  chapterGroup.add(sun);

  const hdrLoader = new RGBELoader();
  const gltfLoader = new GLTFLoader();

  let environmentMap = null;
  let duckModel = null;

  try {
    const [env, model] = await Promise.all([
      hdrLoader.loadAsync(WATER_HDR_PATH),
      gltfLoader.loadAsync(WATER_DUCK_PATH),
    ]);
    env.mapping = THREE.EquirectangularReflectionMapping;
    environmentMap = env;
    duckModel = model.scene.children[0] || model.scene;
    duckModel.receiveShadow = true;
    duckModel.castShadow = true;
  } catch (error) {
    console.warn('Water chapter assets failed to load:', error);
  }

  const geometry = new THREE.PlaneGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1);
  const material = new WaterMaterial({
    color: 0x9bd2ec,
    metalness: 0.9,
    roughness: 0,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });

  const waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.matrixAutoUpdate = false;
  waterMesh.updateMatrix();
  waterMesh.receiveShadow = true;
  waterMesh.castShadow = true;
  chapterGroup.add(waterMesh);

  const borderGeometry = new THREE.TorusGeometry(BOUNDS * 0.7, 0.12, 12, 4);
  borderGeometry.rotateX(Math.PI * 0.5);
  borderGeometry.rotateY(Math.PI * 0.25);
  const poolBorder = new THREE.Mesh(
    borderGeometry,
    new THREE.MeshStandardMaterial({ color: 0x908877, roughness: 0.2 })
  );
  poolBorder.receiveShadow = true;
  poolBorder.castShadow = true;
  chapterGroup.add(poolBorder);

  const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
  const heightmap0 = gpuCompute.createTexture();
  fillTexture(heightmap0, simplex);

  const heightmapVariable = gpuCompute.addVariable('heightmap', shaderChange.heightmap_frag, heightmap0);
  gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);
  heightmapVariable.material.uniforms.mousePos = { value: new THREE.Vector2(10000, 10000) };
  heightmapVariable.material.uniforms.mouseSize = { value: 0.2 };
  heightmapVariable.material.uniforms.viscosity = { value: 0.93 };
  heightmapVariable.material.uniforms.deep = { value: 0.01 };
  heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1);

  const error = gpuCompute.init();
  if (error !== null) {
    console.warn('Water simulation failed to initialize:', error);
    return null;
  }

  const readWaterLevelShader = gpuCompute.createShaderMaterial(readWaterLevelFragmentShader, {
    point1: { value: new THREE.Vector2() },
    levelTexture: { value: null },
  });
  readWaterLevelShader.defines.WIDTH = WIDTH.toFixed(1);
  readWaterLevelShader.defines.BOUNDS = BOUNDS.toFixed(1);

  const readWaterLevelImage = new Uint8Array(4 * 1 * 4);
  const readWaterLevelRenderTarget = new THREE.WebGLRenderTarget(4, 1, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
  });

  if (duckModel) {
    for (let i = 0; i < NUM_DUCK; i += 1) {
      const duck = i < NUM_DUCK - 1 ? duckModel.clone(true) : duckModel;
      duck.position.x = (Math.random() - 0.5) * BOUNDS * 0.7;
      duck.position.z = (Math.random() - 0.5) * BOUNDS * 0.7;
      duck.userData.velocity = new THREE.Vector3();
      chapterGroup.add(duck);
      ducks.push(duck);
    }
  }

  function duckDynamics() {
    readWaterLevelShader.uniforms.levelTexture.value = tmpHeightmap;

    for (let i = 0; i < NUM_DUCK; i += 1) {
      const duck = ducks[i];
      if (!duck) continue;

      const u = 0.5 * duck.position.x / BOUNDS_HALF + 0.5;
      const v = 1 - (0.5 * duck.position.z / BOUNDS_HALF + 0.5);
      readWaterLevelShader.uniforms.point1.value.set(u, v);
      gpuCompute.doRenderTarget(readWaterLevelShader, readWaterLevelRenderTarget);

      renderer.readRenderTargetPixels(readWaterLevelRenderTarget, 0, 0, 4, 1, readWaterLevelImage);
      const pixels = new Float32Array(readWaterLevelImage.buffer);

      waterNormal.set(pixels[1], 0, -pixels[2]);
      const pos = duck.position;
      const startPos = pos.clone();
      pos.y = pixels[0];

      waterNormal.multiplyScalar(0.01);
      duck.userData.velocity.add(waterNormal);
      duck.userData.velocity.multiplyScalar(0.998);
      pos.add(duck.userData.velocity);

      const decal = 0.001;
      const limit = BOUNDS_HALF - 0.2;

      if (pos.x < -limit) {
        pos.x = -limit + decal;
        duck.userData.velocity.x *= -0.3;
      } else if (pos.x > limit) {
        pos.x = limit - decal;
        duck.userData.velocity.x *= -0.3;
      }

      if (pos.z < -limit) {
        pos.z = -limit + decal;
        duck.userData.velocity.z *= -0.3;
      } else if (pos.z > limit) {
        pos.z = limit - decal;
        duck.userData.velocity.z *= -0.3;
      }

      const startNormal = new THREE.Vector3(pixels[1], 1, -pixels[2]).normalize();
      const dir = startPos.sub(pos);
      dir.y = 0;
      dir.normalize();

      const yAxis = new THREE.Vector3(0, 1, 0);
      const zAxis = new THREE.Vector3(0, 0, -1);
      tmpQuatX.setFromUnitVectors(zAxis, dir);
      tmpQuatZ.setFromUnitVectors(yAxis, startNormal);
      tmpQuat.multiplyQuaternions(tmpQuatZ, tmpQuatX);
      duck.quaternion.slerp(tmpQuat, 0.017);
    }
  }

  return {
    environmentMap,
    applyEnvironment(scene) {
      if (!environmentMap) return;
      scene.background = environmentMap;
      scene.environment = environmentMap;
      scene.backgroundBlurriness = 0.12;
      if ('environmentIntensity' in scene) {
        scene.environmentIntensity = 1.25;
      }
    },
    update(isActive) {
      if (!isActive) return;

      heightmapVariable.material.uniforms.mousePos.value.set(10000, 10000);
      frame += 1;

      if (frame < 7 - simulationSpeed) return;
      frame = 0;

      gpuCompute.compute();
      tmpHeightmap = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
      if (ducks.length) duckDynamics();
      material.heightmap = tmpHeightmap;
    },
  };
}
