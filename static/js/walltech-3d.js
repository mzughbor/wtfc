/**
 * Falcon / WallTech embedded Three.js scroll experience.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

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
};

const CHAPTER_COUNT = 6;
const SCENE_DEPTH = 100; // Distance between scenes

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
// CHAPTER 2: MOBILE APPS / UI·UX STUDIO
// ============================================

function createMobileStudio(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  const floor = createBox(18, 0.12, 16, 0xe8ecf1, [0, -0.06, 0], false);
  floor.material.roughness = 0.35;
  group.add(floor);

  const backWall = createBox(18, 7, 0.2, 0xf4f5f8, [0, 3.5, -8], false);
  group.add(backWall);

  const desk = createBox(5, 0.12, 2.4, 0xd9dde5, [0, 0.85, 1.2], false);
  desk.material.roughness = 0.45;
  group.add(desk);

  function createPhone(scale, position, rotationY, tint) {
    const phoneGroup = new THREE.Group();
    const width = 0.72 * scale;
    const height = 1.48 * scale;
    const depth = 0.08 * scale;

    const shell = createBox(width, height, depth, 0x111216, [0, 0, 0]);
    shell.material.metalness = 0.65;
    shell.material.roughness = 0.35;
    phoneGroup.add(shell);

    const screen = createBox(width * 0.9, height * 0.9, 0.015, 0x12151f, [0, 0, depth / 2 + 0.002], false);
    screen.material.emissive = new THREE.Color(tint);
    screen.material.emissiveIntensity = 0.18;
    phoneGroup.add(screen);

    const statusBar = createBox(width * 0.78, 0.06 * scale, 0.01, 0x6c7a89, [0, height * 0.38, depth / 2 + 0.01], false);
    phoneGroup.add(statusBar);

    const heroBlock = createBox(width * 0.78, height * 0.18 * scale, 0.01, COLORS.terracotta, [0, height * 0.2, depth / 2 + 0.01], false);
    heroBlock.material.emissive = new THREE.Color(COLORS.terracotta);
    heroBlock.material.emissiveIntensity = 0.35;
    phoneGroup.add(heroBlock);

    const cardA = createBox(width * 0.36, height * 0.1 * scale, 0.01, 0xffffff, [-width * 0.2, height * 0.02, depth / 2 + 0.01], false);
    const cardB = createBox(width * 0.36, height * 0.1 * scale, 0.01, COLORS.courtroomGold, [width * 0.2, height * 0.02, depth / 2 + 0.01], false);
    phoneGroup.add(cardA, cardB);

    const navBar = createBox(width * 0.78, 0.08 * scale, 0.01, 0x1f2a35, [0, -height * 0.38, depth / 2 + 0.01], false);
    navBar.material.emissive = new THREE.Color(COLORS.neonYellow);
    navBar.material.emissiveIntensity = 0.12;
    phoneGroup.add(navBar);

    phoneGroup.position.set(...position);
    phoneGroup.rotation.y = rotationY;
    return phoneGroup;
  }

  group.add(createPhone(1.35, [0, 1.55, -1.2], 0.08, 0x2d3340));
  group.add(createPhone(0.92, [2.25, 1.22, 0.35], -0.28, 0x31415a));
  group.add(createPhone(0.92, [-2.2, 1.18, 0.45], 0.32, 0x49304a));

  const wireframePanel = createBox(1.6, 1.05, 0.04, 0xffffff, [-3.4, 2.3, -0.4], false);
  const panelAccent = createBox(1.4, 0.08, 0.02, COLORS.terracotta, [-3.4, 2.65, -0.34], false);
  const componentPanel = createBox(1.2, 0.5, 0.03, COLORS.courtroomGold, [3.1, 2.15, -0.6], false);
  panelAccent.material.emissive = new THREE.Color(COLORS.terracotta);
  panelAccent.material.emissiveIntensity = 0.25;
  group.add(wireframePanel, panelAccent, componentPanel);

  const stylus = createCylinder(0.025, 0.025, 0.55, 10, 0x2b2f36, [0.65, 0.97, 1.55]);
  stylus.rotation.z = Math.PI / 2;
  group.add(stylus);

  const swatchColors = [COLORS.terracotta, COLORS.neonYellow, COLORS.courtroomGold, 0x51a7bf, 0x1a1a2e];
  for (let i = 0; i < swatchColors.length; i++) {
    const swatch = createBox(0.16, 0.16, 0.03, swatchColors[i], [-1.2 + i * 0.28, 0.94, 1.78]);
    group.add(swatch);
  }

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
  keyLight.position.set(4, 7, 5);
  keyLight.castShadow = true;
  group.add(keyLight);

  const screenGlow = new THREE.PointLight(0x6fa8ff, 0.9, 10);
  screenGlow.position.set(0, 2, 2);
  group.add(screenGlow);

  const fillLight = new THREE.AmbientLight(0xf2f5f8, 0.55);
  group.add(fillLight);

  return group;
}

// ============================================
// CHAPTER 3: THE COURTHOUSE
// ============================================

function createCourthouse(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  // Marble floor
  const floor = createBox(30, 0.3, 30, 0xF5F5DC, [0, -0.15, 0], false);
  floor.material.roughness = 0.2;
  floor.material.metalness = 0.1;
  group.add(floor);

  // Grand columns
  for (let i = 0; i < 6; i++) {
    const column = createCylinder(0.5, 0.5, 8, 16, 0xFAF0E6, [-7.5 + i * 3, 4, -8]);
    column.material.roughness = 0.3;
    group.add(column);

    // Column base
    const base = createBox(1.2, 0.5, 1.2, 0xFAF0E6, [-7.5 + i * 3, 0.25, -8]);
    group.add(base);

    // Column capital
    const capital = createBox(1.2, 0.4, 1.2, 0xFAF0E6, [-7.5 + i * 3, 8.2, -8]);
    group.add(capital);
  }

  // Entablature (top beam)
  const topBeam = createBox(20, 0.8, 1.5, 0xFAF0E6, [0, 8.8, -8]);
  group.add(topBeam);

  // Steps leading up
  for (let i = 0; i < 5; i++) {
    const step = createBox(18, 0.3, 2, 0xD3D3D3, [0, 0.15 + i * 0.3, 5 + i * 2], false);
    step.material.roughness = 0.4;
    group.add(step);
  }

  // Scales of Justice (simplified)
  const justicePost = createCylinder(0.1, 0.1, 2, 8, COLORS.courtroomGold, [0, 3, -5]);
  justicePost.material.metalness = 0.8;
  const justiceArm = createBox(1.5, 0.05, 0.05, COLORS.courtroomGold, [0, 4, -5]);
  justiceArm.material.metalness = 0.8;
  const pan1 = createCylinder(0.2, 0.15, 0.1, 16, COLORS.courtroomGold, [-0.6, 3.5, -5]);
  const pan2 = createCylinder(0.2, 0.15, 0.1, 16, COLORS.courtroomGold, [0.6, 3.5, -5]);
  group.add(justicePost, justiceArm, pan1, pan2);

  // Benches
  for (let i = 0; i < 3; i++) {
    const bench = createBox(4, 0.5, 0.8, 0x8B4513, [-6 + i * 6, 0.25, 2]);
    group.add(bench);
  }

  // Warm golden light
  const sunlight = new THREE.DirectionalLight(COLORS.courtroomGold, 1.5);
  sunlight.position.set(5, 10, 5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.width = 2048;
  sunlight.shadow.mapSize.height = 2048;
  group.add(sunlight);

  const fillLight = new THREE.AmbientLight(0xFFF8DC, 0.4);
  group.add(fillLight);

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
// CHAPTER 6: THE PRISON CELL
// ============================================

function createPrisonCell(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  // Concrete floor
  const floor = createBox(10, 0.3, 12, COLORS.concrete, [0, -0.15, 0], false);
  group.add(floor);

  // Concrete walls
  const backWall = createBox(10, 6, 0.5, 0x606060, [0, 3, -6], false);
  const leftWall = createBox(0.5, 6, 12, 0x606060, [-5, 3, 0], false);
  const rightWall = createBox(0.5, 6, 12, 0x606060, [5, 3, 0], false);
  group.add(backWall, leftWall, rightWall);

  // Prison bars
  const barMaterial = new THREE.MeshStandardMaterial({
    color: 0x2F2F2F,
    metalness: 0.9,
    roughness: 0.3,
  });

  for (let i = 0; i < 9; i++) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 6, 8),
      barMaterial
    );
    bar.position.set(-4 + i * 1, 3, 5);
    group.add(bar);
  }

  // Top bar
  const topBar = createBox(9, 0.1, 0.1, 0x2F2F2F, [0, 6, 5]);
  topBar.material.metalness = 0.9;
  group.add(topBar);

  // Bottom bar
  const bottomBar = createBox(9, 0.1, 0.1, 0x2F2F2F, [0, 0.05, 5]);
  bottomBar.material.metalness = 0.9;
  group.add(bottomBar);

  // Cot/Bed
  const cotFrame = createBox(2, 0.5, 4, 0x404040, [-3, 0.25, -2]);
  const cotMattress = createBox(1.8, 0.15, 3.8, 0x4A5568, [-3, 0.55, -2]);
  group.add(cotFrame, cotMattress);

  // Thin pillow
  const pillow = createBox(1.5, 0.1, 0.5, 0x718096, [-3, 0.7, -3.5]);
  group.add(pillow);

  // Toilet (simple)
  const toiletBase = createCylinder(0.3, 0.35, 0.5, 16, 0xE5E5E5, [3.5, 0.25, -4]);
  const toiletBowl = createCylinder(0.25, 0.25, 0.3, 16, 0xE5E5E5, [3.5, 0.55, -4]);
  group.add(toiletBase, toiletBowl);

  // Sink
  const sink = createBox(0.8, 0.1, 0.5, 0xE5E5E5, [3.5, 1.2, -5.5]);
  group.add(sink);

  // Small window (high up, barred)
  const windowFrame = createBox(1.5, 1, 0.1, 0x404040, [0, 5, -5.9], false);
  group.add(windowFrame);

  // Window light (freedom glimpse)
  const windowLight = new THREE.SpotLight(0x87CEEB, 2, 15, Math.PI / 6, 0.5);
  windowLight.position.set(0, 5, -5);
  windowLight.target.position.set(0, 0, 0);
  group.add(windowLight);
  group.add(windowLight.target);

  // Harsh overhead light
  const cellLight = new THREE.PointLight(0xFFFFE0, 0.8, 15);
  cellLight.position.set(0, 5.5, 0);
  group.add(cellLight);

  // Ambient
  const coldAmbient = new THREE.AmbientLight(0x4A5568, 0.3);
  group.add(coldAmbient);

  return group;
}

// ============================================
// BUILD ALL SCENES
// ============================================

const chapters = [];

chapters.push(createMailroom(0));
chapters.push(createMobileStudio(SCENE_DEPTH * 1));
chapters.push(createCourthouse(SCENE_DEPTH * 2));
chapters.push(createDesert(SCENE_DEPTH * 3));
chapters.push(createSaulOffice(SCENE_DEPTH * 4));
chapters.push(createPrisonCell(SCENE_DEPTH * 5));

chapters.forEach(chapter => scene.add(chapter));

// ============================================
// SCROLL HANDLING
// ============================================

let currentScroll = 0;
let targetScroll = 0;
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

  // Camera movement through scenes
  const totalDepth = SCENE_DEPTH * (CHAPTER_COUNT - 1);
  camera.position.z = 5 - currentScroll * totalDepth;

  // Subtle camera movements
  camera.position.x = Math.sin(elapsed * 0.3) * 0.5;
  camera.position.y = 2 + Math.sin(elapsed * 0.2) * 0.2;

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

