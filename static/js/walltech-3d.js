/**
 * Falcon / WallTech embedded Three.js scroll experience.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createWaterChapter, initWaterChapter, WATER_CAMERA_DISTANCE } from './walltech-gpgpu-water.js';
import {
  createPostprocessingChapter,
  initPostprocessingComposer,
  POST_CHAPTER_FOG,
} from './walltech-postprocessing.js';

RectAreaLightUniformsLib.init();

const MOBILE_MODEL_PATH = '/static/models/bluemi_12_5g_lowpoly_game_asset.glb';
const MOBILE_DEVICE_LAYOUT = [
  { position: [-9.5, 1.75, -4.5], rotation: [-0.22, 0.48, 0.12], targetHeight: 1.25 },
  { position: [8.25, 2.15, -5.5], rotation: [0.16, -0.54, -0.08], targetHeight: 1.1 },
  { position: [-4.75, 2.65, 6.75], rotation: [-0.12, 0.72, 0.18], targetHeight: 1.05 },
  { position: [10.5, 1.95, 4.0], rotation: [0.2, -0.36, -0.14], targetHeight: 1.15 },
  { position: [-11.0, 3.05, 2.5], rotation: [-0.18, 0.62, 0.1], targetHeight: 1.0 },
  { position: [5.75, 1.55, -8.0], rotation: [0.1, 0.24, -0.06], targetHeight: 1.35 },
];

const root = document.getElementById('walltech-3d-story');
if (!root) {
  throw new Error('WallTech 3D story root not found');
}

const viewport = root.querySelector('.walltech-3d-sticky-viewport');
const canvas = root.querySelector('.walltech-3d-canvas');

// ============================================
// CONFIGURATION
// ============================================

const COLORS = {
  sand: 0xE8DCC4,
  terracotta: 0xC75B39,
  desertNight: 0x1A1A2E,
  mesaBrown: 0x5C4033,
  neonYellow: 0xFFE135,
  neonRed: 0xFF3131,
  courtroomGold: 0xD4AF37,
  prisonGrey: 0x3D3D3D,
  fluorescent: 0xF0F7DA,
  shadow: 0x0D0D0D,
  concrete: 0x808080,
  foil: 0xC0C0C0,
  footerGrey: 0xdbdbdb,
  wallTechBackdrop: 0xf0bf4c,
};

const CHAPTER_COUNT = 6;
const SCENE_DEPTH = 100; // Distance between scenes
const POINTER_SMOOTHING = 0.07;
const MOUSE_PARALLAX = { x: 0.22, y: 0.08 };
const MOUSE_LOOK = { yaw: 0.1, pitch: 0.06, distance: 14, height: 1.6 };
const WATER_CHAPTER_INDEX = 1;
const POST_CHAPTER_INDEX = CHAPTER_COUNT - 1;
const defaultCameraPosition = new THREE.Vector3();
const waterCameraPosition = new THREE.Vector3();
const defaultLookTarget = new THREE.Vector3();
const waterLookTarget = new THREE.Vector3();
const blendedLookTarget = new THREE.Vector3();

// ============================================
// SCENE SETUP
// ============================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.desertNight);
scene.fog = new THREE.Fog(COLORS.desertNight, 10, 80);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ============================================
// LIGHTING
// ============================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// ============================================
// GEOMETRY HELPERS
// ============================================

function createBox(width, height, depth, color, position, castShadow = true) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function createCylinder(radiusTop, radiusBottom, height, segments, color, position) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function prepareLoadedMesh(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function fitModelToHeight(model, targetHeight) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.001);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  return scale;
}

function createFloatingDeviceWrapper(model, layout) {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.userData.isFloatingDevice = true;
  wrapper.userData.floatPhase = Math.random() * Math.PI * 2;
  wrapper.userData.floatSpeed = 0.28 + Math.random() * 0.22;
  wrapper.userData.floatRadius = 0.1 + Math.random() * 0.14;
  wrapper.userData.hoverOffset = layout.position[1];
  wrapper.userData.baseX = layout.position[0];
  wrapper.userData.baseZ = layout.position[2];
  wrapper.position.set(...layout.position);
  wrapper.rotation.set(...layout.rotation);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 32),
    new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.28 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -0.42, 0);
  shadow.userData.isContactShadow = true;
  wrapper.add(shadow);

  return wrapper;
}

function loadMobileDeviceModels(group) {
  const loader = new GLTFLoader();
  loader.load(
    MOBILE_MODEL_PATH,
    (gltf) => {
      const template = gltf.scene;
      prepareLoadedMesh(template);

      MOBILE_DEVICE_LAYOUT.forEach((layout) => {
        const model = template.clone(true);
        fitModelToHeight(model, layout.targetHeight);
        group.add(createFloatingDeviceWrapper(model, layout));
      });
    },
    undefined,
    (error) => {
      console.warn('Mobile GLB failed to load:', error);
    }
  );
}

function createProceduralBrickMaps() {
  const width = 512;
  const height = 512;
  const diffuseCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  diffuseCanvas.width = width;
  diffuseCanvas.height = height;
  bumpCanvas.width = width;
  bumpCanvas.height = height;

  const diffuseCtx = diffuseCanvas.getContext('2d');
  const bumpCtx = bumpCanvas.getContext('2d');
  const brickW = 118;
  const brickH = 52;
  const mortar = 5;
  const palette = ['#7c4f3d', '#8a5844', '#6f4435', '#945840'];

  diffuseCtx.fillStyle = '#2f2520';
  diffuseCtx.fillRect(0, 0, width, height);
  bumpCtx.fillStyle = '#6a6a6a';
  bumpCtx.fillRect(0, 0, width, height);

  for (let row = 0, y = 0; y < height; row += 1, y += brickH + mortar) {
    const offset = (row % 2) * (brickW / 2);
    for (let x = -offset; x < width; x += brickW + mortar) {
      const tone = palette[(row + Math.floor((x + offset) / (brickW + mortar))) % palette.length];
      diffuseCtx.fillStyle = tone;
      diffuseCtx.fillRect(x, y, brickW, brickH);
      bumpCtx.fillStyle = '#a88578';
      bumpCtx.fillRect(x, y, brickW, brickH);
    }
  }

  const diffuse = new THREE.CanvasTexture(diffuseCanvas);
  diffuse.wrapS = THREE.RepeatWrapping;
  diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { diffuse, bump };
}

function createBrickWallMaterial(brickMaps, repeatX, repeatY) {
  const map = brickMaps.diffuse.clone();
  const bumpMap = brickMaps.bump.clone();
  map.repeat.set(repeatX, repeatY);
  bumpMap.repeat.set(repeatX, repeatY);

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.08,
    roughness: 0.88,
    metalness: 0.04,
  });
}

function createWallTechSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1f1712';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '700 118px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0d7b2';
  ctx.fillText('Wall Tech', canvas.width / 2, canvas.height / 2 + 6);

  ctx.strokeStyle = 'rgba(255, 232, 196, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeText('Wall Tech', canvas.width / 2, canvas.height / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBrickWall(width, height, material, position, rotationY = 0) {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  wall.position.set(...position);
  wall.rotation.y = rotationY;
  wall.receiveShadow = true;
  return wall;
}

function createRectAreaLight(color, intensity, width, height, position, target) {
  const light = new THREE.RectAreaLight(color, intensity, width, height);
  light.position.set(...position);
  light.lookAt(target[0], target[1], target[2]);
  return light;
}

// ============================================
// CHAPTER 1: WALL TECH SHOWROOM
// ============================================

function createWallTechRoom(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  const brickMaps = createProceduralBrickMaps();
  const roomWidth = 20;
  const roomDepth = 20;
  const wallHeight = 8;
  const halfWidth = roomWidth / 2;
  const halfDepth = roomDepth / 2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomDepth, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x2a2622,
      roughness: 0.42,
      metalness: 0.28,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomDepth),
    new THREE.MeshStandardMaterial({
      color: 0x1a1816,
      roughness: 0.95,
      metalness: 0.02,
    })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallHeight;
  group.add(ceiling);

  group.add(createBrickWall(halfWidth, wallHeight, createBrickWallMaterial(brickMaps, 2, 2), [-halfWidth / 2, wallHeight / 2, -halfDepth]));
  group.add(createBrickWall(halfWidth, wallHeight, createBrickWallMaterial(brickMaps, 2, 2), [halfWidth / 2, wallHeight / 2, -halfDepth]));
  group.add(createBrickWall(halfWidth, wallHeight, createBrickWallMaterial(brickMaps, 2, 2), [-halfWidth / 2, wallHeight / 2, halfDepth], Math.PI));
  group.add(createBrickWall(halfWidth, wallHeight, createBrickWallMaterial(brickMaps, 2, 2), [halfWidth / 2, wallHeight / 2, halfDepth], Math.PI));
  group.add(createBrickWall(roomDepth, wallHeight, createBrickWallMaterial(brickMaps, 2, 2), [-halfWidth, wallHeight / 2, 0], Math.PI / 2));
  group.add(createBrickWall(roomDepth, wallHeight, createBrickWallMaterial(brickMaps, 2, 2), [halfWidth, wallHeight / 2, 0], -Math.PI / 2));

  const exteriorBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth + 6, wallHeight + 4),
    new THREE.MeshBasicMaterial({ color: COLORS.wallTechBackdrop })
  );
  exteriorBackdrop.position.set(0, wallHeight / 2, -halfDepth - 1.2);
  group.add(exteriorBackdrop);

  const signTexture = createWallTechSignTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 2.1),
    new THREE.MeshStandardMaterial({
      map: signTexture,
      emissive: new THREE.Color(0x6f4a2a),
      emissiveMap: signTexture,
      emissiveIntensity: 0.45,
      roughness: 0.82,
      metalness: 0.08,
    })
  );
  sign.position.set(0, 3.45, -halfDepth + 0.08);
  group.add(sign);

  group.add(createRectAreaLight(0x9aaeff, 4.5, 7, 4, [-halfWidth + 0.35, 3.8, 0], [0, 3.2, 0]));
  group.add(createRectAreaLight(0xf3aaaa, 4.5, 7, 4, [halfWidth - 0.35, 3.8, 0], [0, 3.2, 0]));

  const overhead = new THREE.PointLight(0xfff2d8, 1.2, 24);
  overhead.position.set(0, wallHeight - 0.6, 0);
  overhead.castShadow = true;
  group.add(overhead);

  const fill = new THREE.HemisphereLight(0xf0f0f0, 0x2a1f1a, 0.35);
  group.add(fill);

  return group;
}

// ============================================
// CHAPTER 2: GPGPU WATER
// ============================================

// ============================================
// CHAPTER 3: MOBILE APPS — FLOATING DEVICES
// ============================================

function createFloatingMobileDevices(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  const skyBackdrop = createBox(44, 20, 0.15, 0x2a3f63, [0, 6.5, -16], false);
  skyBackdrop.material.roughness = 1;
  skyBackdrop.material.metalness = 0;
  group.add(skyBackdrop);

  const horizonBand = createBox(44, 0.14, 30, COLORS.sand, [0, 0.35, -1.5], false);
  horizonBand.material.roughness = 0.95;
  group.add(horizonBand);

  const groundGeometry = new THREE.PlaneGeometry(80, 80, 40, 40);
  const groundVertices = groundGeometry.attributes.position.array;
  for (let i = 0; i < groundVertices.length; i += 3) {
    groundVertices[i + 2] = Math.sin(groundVertices[i] * 0.08) * 0.35 + Math.cos(groundVertices[i + 1] * 0.08) * 0.22;
  }
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xd8c7a9,
      roughness: 1,
      metalness: 0,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.35;
  ground.receiveShadow = true;
  group.add(ground);

  const ambient = new THREE.AmbientLight(0xc8d8ea, 0.42);
  group.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.05);
  keyLight.position.set(8, 10, 6);
  keyLight.castShadow = true;
  group.add(keyLight);

  const screenGlow = new THREE.PointLight(0x6fa8ff, 0.55, 24);
  screenGlow.position.set(0, 3, 4);
  group.add(screenGlow);

  const warmth = new THREE.HemisphereLight(0x8fd3ff, COLORS.sand, 0.35);
  group.add(warmth);

  return group;
}

// ============================================
// CHAPTER 4: THE DESERT
// ============================================

function createDesert(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  // Desert floor (undulating sand)
  const sandGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
  const vertices = sandGeometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 2] = Math.sin(vertices[i] * 0.1) * 0.5 + Math.cos(vertices[i + 1] * 0.1) * 0.3;
  }
  sandGeometry.computeVertexNormals();
  const sandMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.sand,
    roughness: 1,
    metalness: 0,
  });
  const sand = new THREE.Mesh(sandGeometry, sandMaterial);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.5;
  sand.receiveShadow = true;
  group.add(sand);

  // Mesa (iconic New Mexico)
  const mesaGeometry = new THREE.CylinderGeometry(8, 10, 6, 6);
  const mesaMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.terracotta,
    roughness: 0.9,
  });
  const mesa = new THREE.Mesh(mesaGeometry, mesaMaterial);
  mesa.position.set(-20, 3, -30);
  mesa.castShadow = true;
  group.add(mesa);

  // Smaller mesa
  const mesa2 = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 6, 4, 6),
    mesaMaterial
  );
  mesa2.position.set(25, 2, -25);
  mesa2.castShadow = true;
  group.add(mesa2);

  // Cacti
  function createCactus(pos) {
    const cactusGroup = new THREE.Group();
    const body = createCylinder(0.3, 0.35, 2.5, 8, 0x228B22, [0, 1.25, 0]);
    cactusGroup.add(body);

    // Arms
    const arm1 = createCylinder(0.15, 0.15, 1, 8, 0x228B22, [0.5, 1.5, 0]);
    arm1.rotation.z = -Math.PI / 4;
    cactusGroup.add(arm1);

    const arm2 = createCylinder(0.15, 0.15, 0.8, 8, 0x228B22, [-0.4, 1.8, 0]);
    arm2.rotation.z = Math.PI / 3;
    cactusGroup.add(arm2);

    cactusGroup.position.set(...pos);
    return cactusGroup;
  }

  group.add(createCactus([5, 0, -5]));
  group.add(createCactus([-8, 0, -10]));
  group.add(createCactus([12, 0, -15]));

  // Desert rocks
  for (let i = 0; i < 10; i++) {
    const rockGeometry = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.5, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.mesaBrown,
      roughness: 0.9,
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(
      -15 + Math.random() * 30,
      0.1,
      -20 + Math.random() * 25
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    group.add(rock);
  }

  // Harsh desert sun
  const sun = new THREE.DirectionalLight(0xFFF5E1, 2);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.far = 100;
  group.add(sun);

  // Heat haze ambient
  const ambientDesert = new THREE.AmbientLight(COLORS.sand, 0.3);
  group.add(ambientDesert);

  // Tumbleweed (simple sphere)
  const tumbleweed = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 1),
    new THREE.MeshStandardMaterial({ color: 0x8B7355, wireframe: true })
  );
  tumbleweed.position.set(3, 0.5, 0);
  tumbleweed.userData.isTumbleweed = true;
  group.add(tumbleweed);

  return group;
}

// ============================================
// CHAPTER 5: SAUL GOODMAN'S OFFICE
// ============================================

function createSaulOffice(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  // Gaudy carpet
  const floor = createBox(20, 0.2, 20, 0x8B0000, [0, -0.1, 0], false);
  group.add(floor);

  // Walls - tacky wallpaper vibe
  const backWall = createBox(20, 8, 0.3, 0x4A0E0E, [0, 4, -10], false);
  const sideWall = createBox(0.3, 8, 20, 0x4A0E0E, [10, 4, 0], false);
  group.add(backWall, sideWall);

  // THE NEON SIGN - "BETTER CALL SAUL"
  const neonGroup = new THREE.Group();

  // Sign backing
  const signBack = createBox(6, 1.5, 0.1, 0x1a1a1a, [0, 5, -9.5]);
  neonGroup.add(signBack);

  // Neon tubes (simplified as glowing boxes)
  const neonMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.neonYellow,
    emissive: COLORS.neonYellow,
    emissiveIntensity: 2,
  });

  // "BETTER" approximation
  const neon1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.1), neonMaterial);
  neon1.position.set(-1.5, 5.3, -9.3);
  neonGroup.add(neon1);

  // "CALL" approximation
  const neon2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.1), neonMaterial);
  neon2.position.set(0, 5, -9.3);
  neonGroup.add(neon2);

  // "SAUL" approximation
  const neon3 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.1), neonMaterial);
  neon3.position.set(1.8, 4.7, -9.3);
  neonGroup.add(neon3);

  // Neon glow light
  const neonLight = new THREE.PointLight(COLORS.neonYellow, 3, 15);
  neonLight.position.set(0, 5, -7);
  neonGroup.add(neonLight);

  group.add(neonGroup);

  // Saul's desk (gaudy and large)
  const desk = createBox(3.5, 0.15, 1.8, 0x8B4513, [0, 1, -3]);
  desk.material.roughness = 0.2; // Polished
  group.add(desk);

  // Desk supports
  const deskFront = createBox(3.5, 1, 0.1, 0x8B4513, [0, 0.5, -2.2]);
  group.add(deskFront);

  // Executive chair
  const chairSeat = createBox(1, 0.15, 1, 0x1a1a1a, [0, 0.8, -4.5]);
  const chairBack = createBox(1, 1.5, 0.15, 0x1a1a1a, [0, 1.5, -5]);
  group.add(chairSeat, chairBack);

  // Constitution backdrop (patriotic kitsch)
  const constitution = createBox(4, 3, 0.05, 0xFFF8DC, [0, 4, -9.8], false);
  group.add(constitution);

  // Inflatable Statue of Liberty (cone approximation)
  const libertyBody = createCylinder(0.3, 0.5, 2, 8, 0x3CB371, [6, 1, -6]);
  const libertyHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x3CB371 })
  );
  libertyHead.position.set(6, 2.3, -6);
  const libertyCrown = createCylinder(0.1, 0.35, 0.3, 7, 0xFFD700, [6, 2.7, -6]);
  group.add(libertyBody, libertyHead, libertyCrown);

  // Client chairs
  const clientChair1 = createBox(0.8, 0.6, 0.8, 0x654321, [-2, 0.3, 0]);
  const clientChair2 = createBox(0.8, 0.6, 0.8, 0x654321, [2, 0.3, 0]);
  group.add(clientChair1, clientChair2);

  // Gold accents
  const goldOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshStandardMaterial({ color: COLORS.courtroomGold, metalness: 0.9, roughness: 0.1 })
  );
  goldOrb.position.set(1, 1.25, -3);
  group.add(goldOrb);

  // Red accent light
  const redLight = new THREE.PointLight(COLORS.neonRed, 1, 10);
  redLight.position.set(-5, 3, 0);
  group.add(redLight);

  // Overhead light
  const overheadLight = new THREE.PointLight(0xFFFFE0, 1.5, 20);
  overheadLight.position.set(0, 6, -2);
  group.add(overheadLight);

  return group;
}

// ============================================
// BUILD ALL SCENES
// ============================================

const chapters = [];

chapters.push(createWallTechRoom(0));
chapters.push(createWaterChapter(SCENE_DEPTH * 1));
chapters.push(createFloatingMobileDevices(SCENE_DEPTH * 2));
chapters.push(createDesert(SCENE_DEPTH * 3));
chapters.push(createSaulOffice(SCENE_DEPTH * 4));
chapters.push(createPostprocessingChapter(SCENE_DEPTH * 5));

chapters.forEach(chapter => scene.add(chapter));
loadMobileDeviceModels(chapters[2]);

const postComposer = initPostprocessingComposer(renderer, scene, camera);

let waterSystem = null;
initWaterChapter(renderer, chapters[1]).then((state) => {
  waterSystem = state;
});

// ============================================
// SCROLL HANDLING
// ============================================

let currentScroll = 0;
let targetScroll = 0;
let targetPointerX = 0;
let targetPointerY = 0;
let pointerX = 0;
let pointerY = 0;
const progressFill = root.querySelector('.walltech-3d-progress-fill');
const chapterIndicator = root.querySelector('.walltech-3d-current-chapter');
const chapterElements = root.querySelectorAll('.walltech-chapter');
const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function getStoryScrollProgress() {
  const rect = root.getBoundingClientRect();
  const storyTop = window.scrollY + rect.top;
  const maxScroll = Math.max(root.offsetHeight - window.innerHeight, 1);
  const scrolled = window.scrollY - storyTop;
  return Math.min(Math.max(scrolled / maxScroll, 0), 1);
}

function resolveSceneBackdrop(chapterIndex) {
  if (chapterIndex === 0 || chapterIndex === WATER_CHAPTER_INDEX) return COLORS.wallTechBackdrop;
  if (chapterIndex === POST_CHAPTER_INDEX) return POST_CHAPTER_FOG;
  return COLORS.desertNight;
}

function resolveViewportBackdrop(chapterIndex) {
  if (chapterIndex === 0 || chapterIndex === WATER_CHAPTER_INDEX) return '#f0bf4c';
  if (chapterIndex === POST_CHAPTER_INDEX) return '#000000';
  return '#1a1a2e';
}

function chapterVisibility(chapterFloat, index) {
  const distance = Math.abs(chapterFloat - (index + 0.5));
  return Math.max(0, 1 - distance * 2);
}

function updateChapterUI(scrollProgress) {
  const chapterFloat = scrollProgress * CHAPTER_COUNT;
  const dominantChapter = Math.min(
    Math.max(Math.floor(chapterFloat + 1e-4), 0),
    CHAPTER_COUNT - 1
  );

  if (progressFill) {
    progressFill.style.width = `${scrollProgress * 100}%`;
  }

  if (chapterIndicator) {
    chapterIndicator.textContent = romanNumerals[dominantChapter];
  }

  chapterElements.forEach((el, index) => {
    const visibility = chapterVisibility(chapterFloat, index);
    if (visibility > 0.02) {
      el.classList.add('visible');
      el.style.setProperty('--chapter-opacity', visibility.toFixed(3));
    } else {
      el.classList.remove('visible');
      el.style.removeProperty('--chapter-opacity');
    }
  });
}

function updateScroll() {
  const scrollProgress = getStoryScrollProgress();
  targetScroll = scrollProgress;
  updateChapterUI(scrollProgress);
}

function updatePointerTarget(clientX, clientY) {
  if (!viewport) return;

  const rect = viewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  targetPointerX = (x - 0.5) * 2;
  targetPointerY = (y - 0.5) * 2;
}

function resetPointerTarget() {
  targetPointerX = 0;
  targetPointerY = 0;
}

window.addEventListener('pointermove', (event) => {
  updatePointerTarget(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('pointerleave', resetPointerTarget);

window.addEventListener('scroll', updateScroll);
updateScroll();

// ============================================
// ANIMATION LOOP
// ============================================

const clock = new THREE.Clock();

let isActive = false;
let animationFrameId = null;

function handleResize() {
  if (!viewport) return;
  const width = viewport.clientWidth || 1;
  const height = viewport.clientHeight || 1;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  postComposer.setSize(width, height);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (!isActive) return;

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Smooth scroll interpolation
  currentScroll += (targetScroll - currentScroll) * 0.05;
  pointerX += (targetPointerX - pointerX) * POINTER_SMOOTHING;
  pointerY += (targetPointerY - pointerY) * POINTER_SMOOTHING;
  updateChapterUI(currentScroll);

  const chapterFloat = currentScroll * CHAPTER_COUNT;
  const activeChapter = Math.min(
    Math.max(Math.floor(chapterFloat + 1e-4), 0),
    CHAPTER_COUNT - 1
  );
  const waterInfluence = chapterVisibility(chapterFloat, WATER_CHAPTER_INDEX);
  const postInfluence = chapterVisibility(chapterFloat, POST_CHAPTER_INDEX);
  const sceneBackdrop = resolveSceneBackdrop(activeChapter);

  if (waterInfluence > 0.02) {
    scene.background.set(COLORS.wallTechBackdrop);
    scene.backgroundBlurriness = 0;
    if (waterSystem?.environmentMap) {
      scene.environment = waterSystem.environmentMap;
      if ('environmentIntensity' in scene) {
        scene.environmentIntensity = THREE.MathUtils.lerp(1, 0.55, waterInfluence);
      }
    } else {
      scene.environment = null;
    }
    if (!scene.fog) {
      scene.fog = new THREE.Fog(COLORS.wallTechBackdrop, 10, 80);
    }
    scene.fog.color.set(COLORS.wallTechBackdrop);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.2, 0.65, waterInfluence);
    if (viewport) {
      viewport.style.background = '#f0bf4c';
    }
  } else if (postInfluence > 0.02) {
    scene.background.set(POST_CHAPTER_FOG);
    scene.environment = null;
    scene.backgroundBlurriness = 0;
    if ('environmentIntensity' in scene) {
      scene.environmentIntensity = 1;
    }
    if (!scene.fog) {
      scene.fog = new THREE.Fog(POST_CHAPTER_FOG, 1, 1000);
    } else {
      scene.fog.near = 1;
      scene.fog.far = 1000;
      scene.fog.color.set(POST_CHAPTER_FOG);
    }
    renderer.toneMappingExposure = 1.2;
    if (viewport) {
      viewport.style.background = '#000000';
    }
  } else {
    scene.background.set(sceneBackdrop);
    scene.environment = null;
    scene.backgroundBlurriness = 0;
    if ('environmentIntensity' in scene) {
      scene.environmentIntensity = 1;
    }
    if (!scene.fog) {
      scene.fog = new THREE.Fog(COLORS.desertNight, 10, 80);
    } else {
      scene.fog.near = 10;
      scene.fog.far = 80;
    }
    scene.fog.color.set(sceneBackdrop);
    renderer.toneMappingExposure = 1.2;
    if (viewport) {
      viewport.style.background = resolveViewportBackdrop(activeChapter);
    }
  }

  // Camera movement through scenes
  const totalDepth = SCENE_DEPTH * (CHAPTER_COUNT - 1);
  const chapterWorldZ = -SCENE_DEPTH;
  const driftX = Math.sin(elapsed * 0.3) * 0.5;
  const driftY = 2 + Math.sin(elapsed * 0.2) * 0.2;

  defaultCameraPosition.set(
    driftX + pointerX * MOUSE_PARALLAX.x,
    driftY + pointerY * MOUSE_PARALLAX.y,
    5 - currentScroll * totalDepth
  );
  defaultLookTarget.set(
    pointerX * MOUSE_LOOK.yaw * MOUSE_LOOK.distance,
    MOUSE_LOOK.height + pointerY * MOUSE_LOOK.pitch * MOUSE_LOOK.distance * 0.35,
    defaultCameraPosition.z - MOUSE_LOOK.distance
  );

  waterCameraPosition.set(
    pointerX * MOUSE_PARALLAX.x * 0.2,
    2.0 + pointerY * 0.04,
    chapterWorldZ + WATER_CAMERA_DISTANCE
  );
  waterLookTarget.set(0, 0.15, chapterWorldZ);

  const waterFov = THREE.MathUtils.lerp(60, 68, waterInfluence);
  camera.fov = waterFov;
  camera.updateProjectionMatrix();

  camera.position.lerpVectors(defaultCameraPosition, waterCameraPosition, waterInfluence);
  blendedLookTarget.lerpVectors(defaultLookTarget, waterLookTarget, waterInfluence);
  camera.lookAt(blendedLookTarget);

  if (waterSystem) {
    waterSystem.update(waterInfluence > 0.05);
  }

  const postRoot = chapters[POST_CHAPTER_INDEX].userData.postRoot;
  if (postRoot && postInfluence > 0.02) {
    postRoot.rotation.x += 0.005 * postInfluence;
    postRoot.rotation.y += 0.01 * postInfluence;
  }

  // Gentle drift for floating mobile devices
  const mobileGroup = chapters[2];
  mobileGroup.traverse((child) => {
    if (!child.userData.isFloatingDevice) return;

    const phase = child.userData.floatPhase;
    const speed = child.userData.floatSpeed;
    const radius = child.userData.floatRadius;
    const baseY = child.userData.hoverOffset;

    child.position.y = baseY + Math.sin(elapsed * speed + phase) * radius;
    child.position.x = child.userData.baseX + Math.sin(elapsed * speed * 0.7 + phase) * 0.12;
    child.position.z = child.userData.baseZ + Math.cos(elapsed * speed * 0.6 + phase) * 0.12;
    child.rotation.y += delta * 0.15 * speed;
    child.rotation.z = Math.sin(elapsed * 0.4 + phase) * 0.05;
  });

  const desertGroup = chapters[3];
  desertGroup.children.forEach((child) => {
    if (child.userData.isTumbleweed) {
      child.rotation.x += delta * 2;
      child.rotation.z += delta * 1.5;
      child.position.x += delta * 0.5;
      if (child.position.x > 15) child.position.x = -15;
    }
  });

  // Flicker neon in Saul's office
  const saulGroup = chapters[4];
  saulGroup.children.forEach(child => {
    if (child.isGroup) {
      child.children.forEach(neonPart => {
        if (neonPart.material && neonPart.material.emissiveIntensity) {
          neonPart.material.emissiveIntensity = 1.8 + Math.sin(elapsed * 10) * 0.3;
        }
      });
    }
  });

  if (postInfluence > 0.08) {
    postComposer.render();
  } else {
    renderer.render(scene, camera);
  }
}

window.addEventListener('resize', handleResize);

const scrollHint = document.createElement('div');
scrollHint.className = 'walltech-3d-scroll-hint';
scrollHint.innerHTML = '<span>SCROLL</span><div class="arrow"></div>';
if (viewport) {
  viewport.appendChild(scrollHint);
}

window.addEventListener('scroll', () => {
  if (getStoryScrollProgress() > 0.02) {
    scrollHint.classList.add('hidden');
  }
}, { once: true });

const loading = document.createElement('div');
loading.className = 'walltech-3d-loading';
loading.innerHTML = '<span class="walltech-3d-loading-text">LOADING</span>';
if (viewport) {
  viewport.appendChild(loading);
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    isActive = entry.isIntersecting;
    if (isActive) {
      updateScroll();
    }
  });
}, { threshold: 0.05 });

observer.observe(root);
handleResize();
updateScroll();

setTimeout(() => {
  loading.classList.add('done');
  animate();
}, 500);

