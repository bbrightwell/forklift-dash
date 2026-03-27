/** Three.js scene, renderer, camera, lighting, controls */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let animCallbacks = [];

export function initScene() {
  const canvas = document.getElementById('three-canvas');
  const wrapper = document.getElementById('canvas-wrapper');

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050a0f);

  // Camera
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.8, 1.6, 3.2);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // Lighting
  // Key light — warm directional from upper-front-left
  const keyLight = new THREE.DirectionalLight(0xfff0e0, 1.4);
  keyLight.position.set(-3, 4, 3);
  scene.add(keyLight);

  // Fill light — cool from right
  const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.6);
  fillLight.position.set(4, 2, -1);
  scene.add(fillLight);

  // Ambient
  const ambient = new THREE.AmbientLight(0x222230, 0.5);
  scene.add(ambient);

  // Hemisphere ground bounce
  const hemi = new THREE.HemisphereLight(0x606080, 0x302010, 0.4);
  scene.add(hemi);

  // Size
  resize();
  window.addEventListener('resize', resize);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    for (const cb of animCallbacks) cb();
    renderer.render(scene, camera);
  }
  animate();
}

function resize() {
  const wrapper = document.getElementById('canvas-wrapper');
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);

  // Also resize callout canvas
  const callout = document.getElementById('callout-canvas');
  callout.width = w;
  callout.height = h;
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }

export function onAnimate(cb) { animCallbacks.push(cb); }
