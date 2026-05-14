import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/shaders/RGBShiftShader.js';
import { DotScreenShader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/shaders/DotScreenShader.js';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js';

export const POST_CHAPTER_FOG = 0x000000;
export const POST_SPHERE_COUNT = 100;

export function createPostprocessingChapter(zOffset) {
  const group = new THREE.Group();
  group.position.z = -zOffset;

  const object = new THREE.Object3D();
  object.userData.isPostObject = true;
  const geometry = new THREE.SphereGeometry(1, 4, 4);
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });

  for (let i = 0; i < POST_SPHERE_COUNT; i += 1) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    mesh.position.multiplyScalar(Math.random() * 400);
    mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    const scale = Math.random() * 50;
    mesh.scale.set(scale, scale, scale);
    object.add(mesh);
  }

  group.add(object);
  group.userData.postRoot = object;

  group.add(new THREE.AmbientLight(0xcccccc));

  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(1, 1, 1);
  group.add(light);

  return group;
}

export function initPostprocessingComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const dotScreenPass = new ShaderPass(DotScreenShader);
  dotScreenPass.uniforms.scale.value = 4;
  composer.addPass(dotScreenPass);

  const rgbShiftPass = new ShaderPass(RGBShiftShader);
  rgbShiftPass.uniforms.amount.value = 0.0015;
  composer.addPass(rgbShiftPass);

  composer.addPass(new OutputPass());

  return composer;
}
