/**
 * Falcon / WallTech embedded Three.js scroll experience.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

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
};

const CHAPTER_COUNT = 6;
const SCENE_DEPTH = 100; // Distance between scenes
const POINTER_SMOOTHING = 0.09;
const MOUSE_PARALLAX = { x: 0.85, y: 0.32 };
const MOUSE_LOOK = { yaw: 0.38, pitch: 0.24, distance: 14, height: 1.6 };

// ============================================
// SCENE SETUP
// ============================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.desertNight);
scene.fog = new THREE.Fog(COLORS.desertNight, 10, 80);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
camera.position.set(0, 2, 5);
const cameraLookTarget = new THREE.Vector3();

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

// ============================================
// CHAPTER 1: THE MAILROOM
// ============================================

function createMailroom(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  // Floor
  const floor = createBox(20, 0.2, 20, 0x404040, [0, -0.1, 0], false);
  group.add(floor);

  // Walls
  const backWall = createBox(20, 8, 0.3, 0x505050, [0, 4, -10], false);
  group.add(backWall);

  // Mail cart
  const cart = createBox(1.5, 0.8, 1, 0x666666, [-2, 0.4, 0]);
  group.add(cart);

  // Mailboxes (grid of boxes)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 6; j++) {
      const mailbox = createBox(0.5, 0.4, 0.3, 0x8B7355, [-8 + i * 0.6, 1 + j * 0.5, -9]);
      group.add(mailbox);
    }
  }

  // Filing cabinets
  for (let i = 0; i < 3; i++) {
    const cabinet = createBox(0.8, 2.5, 0.6, 0x505050, [6, 1.25, -8 + i * 2]);
    group.add(cabinet);
  }

  // Stack of mail boxes
  for (let i = 0; i < 5; i++) {
    const box = createBox(0.6, 0.4, 0.6, 0xD2B48C, [2 + (i % 2) * 0.3, 0.2 + i * 0.45, 2]);
    box.rotation.y = Math.random() * 0.2;
    group.add(box);
  }

  // Fluorescent lights (the soul-crushing kind)
  const lightFixture1 = createBox(4, 0.1, 0.5, 0xffffff, [0, 6, 0], false);
  lightFixture1.material.emissive = new THREE.Color(COLORS.fluorescent);
  lightFixture1.material.emissiveIntensity = 0.5;
  group.add(lightFixture1);

  const lightFixture2 = createBox(4, 0.1, 0.5, 0xffffff, [-4, 6, -4], false);
  lightFixture2.material.emissive = new THREE.Color(COLORS.fluorescent);
  lightFixture2.material.emissiveIntensity = 0.5;
  group.add(lightFixture2);

  // Overhead light
  const light = new THREE.PointLight(COLORS.fluorescent, 2, 20);
  light.position.set(0, 5, 0);
  light.castShadow = true;
  group.add(light);

  // Desk
  const desk = createBox(2, 0.1, 1, 0x8B4513, [0, 1, 3]);
  group.add(desk);
  const deskLeg1 = createBox(0.1, 1, 0.1, 0x8B4513, [-0.9, 0.5, 3.4]);
  const deskLeg2 = createBox(0.1, 1, 0.1, 0x8B4513, [0.9, 0.5, 3.4]);
  const deskLeg3 = createBox(0.1, 1, 0.1, 0x8B4513, [-0.9, 0.5, 2.6]);
  const deskLeg4 = createBox(0.1, 1, 0.1, 0x8B4513, [0.9, 0.5, 2.6]);
  group.add(deskLeg1, deskLeg2, deskLeg3, deskLeg4);

  return group;
}

// ============================================
// CHAPTER 2: CHUCK'S HOUSE
// ============================================

function createChucksHouse(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  const floor = createBox(20, 0.2, 20, 0x3D2914, [0, -0.1, 0], false);
  group.add(floor);

  const backWall = createBox(20, 8, 0.3, 0x2D2D2D, [0, 4, -10], false);
  const leftWall = createBox(0.3, 8, 20, 0x2D2D2D, [-10, 4, 0], false);
  group.add(backWall, leftWall);

  const window1 = createBox(3, 2.5, 0.1, COLORS.foil, [-9.7, 3.5, -4], false);
  window1.material.metalness = 0.9;
  window1.material.roughness = 0.3;
  const window2 = createBox(3, 2.5, 0.1, COLORS.foil, [-9.7, 3.5, 3], false);
  window2.material.metalness = 0.9;
  window2.material.roughness = 0.3;
  group.add(window1, window2);

  function createLantern(pos) {
    const lanternGroup = new THREE.Group();
    const base = createCylinder(0.1, 0.15, 0.3, 8, 0x8B4513, [0, 0, 0]);
    const glass = createCylinder(0.1, 0.1, 0.4, 8, 0xFFD700, [0, 0.3, 0]);
    glass.material.transparent = true;
    glass.material.opacity = 0.7;
    glass.material.emissive = new THREE.Color(0xFFD700);
    glass.material.emissiveIntensity = 0.8;
    lanternGroup.add(base, glass);
    lanternGroup.position.set(...pos);

    const lanternLight = new THREE.PointLight(0xFFAA00, 0.8, 8);
    lanternLight.position.set(0, 0.3, 0);
    lanternGroup.add(lanternLight);

    return lanternGroup;
  }

  group.add(createLantern([-3, 1.1, 2]));
  group.add(createLantern([4, 0.5, -2]));

  const couchBase = createBox(3, 0.5, 1.2, 0x4A3728, [0, 0.25, 0]);
  const couchBack = createBox(3, 1, 0.3, 0x4A3728, [0, 0.75, -0.55]);
  const couchArm1 = createBox(0.3, 0.7, 1.2, 0x4A3728, [-1.5, 0.35, 0]);
  const couchArm2 = createBox(0.3, 0.7, 1.2, 0x4A3728, [1.5, 0.35, 0]);
  group.add(couchBase, couchBack, couchArm1, couchArm2);

  const pianoBody = createBox(2, 1, 0.8, 0x1A1A1A, [5, 0.5, -7]);
  const pianoTop = createBox(2.1, 0.1, 0.9, 0x1A1A1A, [5, 1.05, -7]);
  const pianoKeys = createBox(1.8, 0.05, 0.15, 0xFFFFF0, [5, 1, -6.5]);
  group.add(pianoBody, pianoTop, pianoKeys);

  const blanket = createBox(2, 0.02, 3, COLORS.foil, [-5, 0.02, 2], false);
  blanket.material.metalness = 1;
  blanket.material.roughness = 0.2;
  group.add(blanket);

  for (let i = 0; i < 6; i++) {
    const book = createBox(0.2, 0.3, 0.4, [0x8B0000, 0x006400, 0x000080][i % 3],
      [-2 + i * 0.5, 0.15, 3 + Math.random()]);
    book.rotation.y = Math.random() * Math.PI;
    group.add(book);
  }

  const dimLight = new THREE.AmbientLight(0x1a1a1a, 0.3);
  group.add(dimLight);

  return group;
}

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
// CHAPTER 6: FLOATING ISLANDS
// ============================================

function createFloatingIslands(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  function createIsland(width, rockHeight, grassHeight, position, rotationY = 0) {
    const islandGroup = new THREE.Group();
    islandGroup.userData.isFloatingIsland = true;
    islandGroup.userData.floatPhase = Math.random() * Math.PI * 2;
    islandGroup.userData.floatSpeed = 0.25 + Math.random() * 0.2;
    islandGroup.userData.hoverOffset = position[1];

    const rock = createCylinder(width, width * 1.35, rockHeight, 8, COLORS.mesaBrown, [0, rockHeight / 2 - grassHeight, 0]);
    rock.material.roughness = 0.95;
    islandGroup.add(rock);

    const grass = createCylinder(width * 1.05, width, grassHeight, 12, 0x4c8f4a, [0, grassHeight * 0.35, 0]);
    grass.material.roughness = 0.9;
    islandGroup.add(grass);

    islandGroup.position.set(...position);
    islandGroup.rotation.y = rotationY;
    return islandGroup;
  }

  function createTree(position) {
    const tree = new THREE.Group();
    const trunk = createCylinder(0.12, 0.16, 0.65, 8, 0x6b4d2e, [0, 0.32, 0]);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.85 })
    );
    leaves.position.set(0, 0.78, 0);
    leaves.castShadow = true;
    tree.add(trunk, leaves);
    tree.position.set(...position);
    return tree;
  }

  const mainIsland = createIsland(3.2, 2.4, 0.55, [0, 2.2, 0], 0.18);
  mainIsland.add(createTree([0.65, 0.48, 0.3]));
  mainIsland.add(createTree([-0.8, 0.48, -0.45]));
  group.add(mainIsland);

  group.add(createIsland(1.6, 1.25, 0.3, [-3.2, 3.1, -1.4], 0.1));
  group.add(createIsland(1.45, 1.1, 0.28, [2.8, 3.35, 0.95], -0.22));
  group.add(createIsland(1.15, 0.85, 0.22, [-1.1, 3.75, 1.65], 0.36));
  group.add(createIsland(1.0, 0.75, 0.18, [1.3, 3.95, -1.05], -0.14));

  const skyBackdrop = createBox(44, 20, 0.15, COLORS.footerGrey, [0, 6.5, -16], false);
  skyBackdrop.material.roughness = 1;
  skyBackdrop.material.metalness = 0;
  group.add(skyBackdrop);

  const mist = createBox(22, 0.08, 22, COLORS.footerGrey, [0, 0.9, 1.5], false);
  mist.material.transparent = true;
  mist.material.opacity = 0.45;
  group.add(mist);

  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(6, 11, 5);
  sun.castShadow = true;
  group.add(sun);

  const skyFill = new THREE.HemisphereLight(0xf0f0f0, COLORS.footerGrey, 0.62);
  group.add(skyFill);

  const fill = new THREE.AmbientLight(0xe2e2e2, 0.35);
  group.add(fill);

  return group;
}

// ============================================
// BUILD ALL SCENES
// ============================================

const chapters = [];

chapters.push(createMailroom(0));
chapters.push(createChucksHouse(SCENE_DEPTH * 1));
chapters.push(createFloatingMobileDevices(SCENE_DEPTH * 2));
chapters.push(createDesert(SCENE_DEPTH * 3));
chapters.push(createSaulOffice(SCENE_DEPTH * 4));
chapters.push(createFloatingIslands(SCENE_DEPTH * 5));

chapters.forEach(chapter => scene.add(chapter));
loadMobileDeviceModels(chapters[2]);

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

function updateScroll() {
  const scrollProgress = getStoryScrollProgress();
  targetScroll = scrollProgress;

  if (progressFill) {
    progressFill.style.width = `${scrollProgress * 100}%`;
  }

  const currentChapterIndex = Math.min(
    Math.floor(scrollProgress * CHAPTER_COUNT),
    CHAPTER_COUNT - 1
  );
  if (chapterIndicator) {
    chapterIndicator.textContent = romanNumerals[currentChapterIndex];
  }

  chapterElements.forEach((el, index) => {
    const chapterStart = index / CHAPTER_COUNT;
    const chapterEnd = (index + 1) / CHAPTER_COUNT;

    if (scrollProgress >= chapterStart - 0.1 && scrollProgress <= chapterEnd + 0.1) {
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  });
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

  const activeChapter = Math.min(
    Math.floor(currentScroll * CHAPTER_COUNT),
    CHAPTER_COUNT - 1
  );
  const footerSceneActive = activeChapter === CHAPTER_COUNT - 1;
  scene.background.set(footerSceneActive ? COLORS.footerGrey : COLORS.desertNight);
  if (scene.fog) {
    scene.fog.color.set(footerSceneActive ? COLORS.footerGrey : COLORS.desertNight);
  }

  // Camera movement through scenes
  const totalDepth = SCENE_DEPTH * (CHAPTER_COUNT - 1);
  camera.position.z = 5 - currentScroll * totalDepth;

  // Subtle camera movements with mouse-driven parallax and look
  const driftX = Math.sin(elapsed * 0.3) * 0.5;
  const driftY = 2 + Math.sin(elapsed * 0.2) * 0.2;
  camera.position.x = driftX + pointerX * MOUSE_PARALLAX.x;
  camera.position.y = driftY + pointerY * MOUSE_PARALLAX.y;

  cameraLookTarget.set(
    pointerX * MOUSE_LOOK.yaw * MOUSE_LOOK.distance,
    MOUSE_LOOK.height + pointerY * MOUSE_LOOK.pitch * MOUSE_LOOK.distance * 0.35,
    camera.position.z - MOUSE_LOOK.distance
  );
  camera.lookAt(cameraLookTarget);

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

  // Gentle bob for floating islands
  const islandGroup = chapters[5];
  islandGroup.traverse((child) => {
    if (!child.userData.isFloatingIsland) return;

    const phase = child.userData.floatPhase;
    const speed = child.userData.floatSpeed;
    const baseY = child.userData.hoverOffset;

    child.position.y = baseY + Math.sin(elapsed * speed + phase) * 0.18;
  });

  // Rotate tumbleweed in desert scene
  const desertGroup = chapters[3];
  desertGroup.children.forEach(child => {
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

  renderer.render(scene, camera);
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

