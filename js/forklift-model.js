/** Load forklift GLB, manage fork height, provide callout positions */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getScene, getCamera, onAnimate } from './scene.js';

let model = null;
let forkGroup = null;
let forkBaseY = 0;
const MAX_FORK_INCHES = 240;

// Callout anchor positions — will be updated once model loads
const calloutAnchors = {
  MAST:            new THREE.Vector3(-0.5, 1.8, 0),
  DEADMAN:         new THREE.Vector3(-0.3, 1.1, 0),
  FORKS:           new THREE.Vector3(-0.4, 0.3, 0.5),
  'DRIVE AXLE':    new THREE.Vector3(-0.3, 0.15, -0.6),
  'OVERHEAD GUARD': new THREE.Vector3(0.3, 2.0, 0),
  BATTERY:          new THREE.Vector3(0.4, 0.6, -0.3),
  HYDRAULICS:       new THREE.Vector3(0.3, 1.4, 0.2),
  COUNTERWEIGHT:    new THREE.Vector3(0.3, 0.5, -0.8),
  'STEER AXLE':     new THREE.Vector3(0.3, 0.15, -0.9),
};

// Callout definitions: side = left or right
const calloutDefs = {
  MAST:              { side: 'left' },
  DEADMAN:           { side: 'left' },
  FORKS:             { side: 'left' },
  'DRIVE AXLE':      { side: 'left' },
  'OVERHEAD GUARD':  { side: 'right' },
  BATTERY:           { side: 'right' },
  HYDRAULICS:        { side: 'right' },
  COUNTERWEIGHT:     { side: 'right' },
  'STEER AXLE':      { side: 'right' },
};

// CAN IDs for callout labels
const calloutCanIds = {
  MAST:              '0x205',
  DEADMAN:           '0x300',
  FORKS:             '0x205',
  'DRIVE AXLE':      '0x0C0',
  'OVERHEAD GUARD':  '—',
  BATTERY:           '0x620',
  HYDRAULICS:        '0x210',
  COUNTERWEIGHT:     '—',
  'STEER AXLE':      '—',
};

export function loadForkliftModel() {
  const loader = new GLTFLoader();
  loader.load('forklift.glb', (gltf) => {
    model = gltf.scene;
    model.scale.setScalar(1);
    getScene().add(model);

    // Log all mesh names so user can identify fork carriage
    console.log('=== Forklift model mesh names ===');
    model.traverse((child) => {
      if (child.isMesh) {
        console.log(`  Mesh: "${child.name}" (parent: "${child.parent?.name}")`);
      }
    });

    // Try to find fork/carriage group
    const forkNames = ['fork', 'forks', 'carriage', 'lift', 'mast'];
    model.traverse((child) => {
      if (forkGroup) return;
      const n = child.name.toLowerCase();
      for (const fn of forkNames) {
        if (n.includes(fn)) {
          forkGroup = child;
          forkBaseY = child.position.y;
          console.log(`  >> Identified fork group: "${child.name}"`);
          return;
        }
      }
    });

    if (!forkGroup) {
      console.warn('Could not auto-detect fork group. Call setForkGroup(name) manually.');
    }

    // Recompute callout anchors from bounding box
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Adjust anchors relative to model bounds
    calloutAnchors.MAST.set(center.x - size.x * 0.35, center.y + size.y * 0.4, center.z);
    calloutAnchors.DEADMAN.set(center.x - size.x * 0.15, center.y + size.y * 0.1, center.z);
    calloutAnchors.FORKS.set(center.x - size.x * 0.3, center.y - size.y * 0.3, center.z + size.z * 0.3);
    calloutAnchors['DRIVE AXLE'].set(center.x - size.x * 0.15, center.y - size.y * 0.45, center.z - size.z * 0.2);
    calloutAnchors['OVERHEAD GUARD'].set(center.x + size.x * 0.15, center.y + size.y * 0.45, center.z);
    calloutAnchors.BATTERY.set(center.x + size.x * 0.2, center.y - size.y * 0.1, center.z - size.z * 0.1);
    calloutAnchors.HYDRAULICS.set(center.x + size.x * 0.15, center.y + size.y * 0.2, center.z + size.z * 0.1);
    calloutAnchors.COUNTERWEIGHT.set(center.x + size.x * 0.2, center.y - size.y * 0.15, center.z - size.z * 0.3);
    calloutAnchors['STEER AXLE'].set(center.x + size.x * 0.15, center.y - size.y * 0.45, center.z - size.z * 0.35);

    // Center model
    model.position.sub(center);
    model.position.y += size.y * 0.5;

  }, undefined, (err) => {
    console.error('Failed to load forklift.glb:', err);
  });

  // Draw callouts each frame
  onAnimate(drawCallouts);
}

/** Set fork height 0-240 inches, maps to Y translation */
export function setForkHeight(inches) {
  if (!forkGroup) return;
  const t = Math.max(0, Math.min(1, inches / MAX_FORK_INCHES));
  // Map to ~1.5 units of Y travel
  forkGroup.position.y = forkBaseY + t * 1.5;
}

/** Return callout world positions */
export function getCalloutWorldPositions() {
  return { ...calloutAnchors };
}

/** Project 3D point to screen coords */
function toScreen(vec3, camera, width, height) {
  const v = vec3.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
    z: v.z
  };
}

/** Draw 2D callout overlay */
function drawCallouts() {
  const canvas = document.getElementById('callout-canvas');
  if (!canvas || !model) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const camera = getCamera();
  const margin = 80;
  let leftY = 120;
  let rightY = 120;
  const yStep = 68;

  for (const [name, def] of Object.entries(calloutDefs)) {
    const worldPos = calloutAnchors[name];
    if (!worldPos) continue;

    // Transform anchor by model position
    const absPos = worldPos.clone();
    if (model) absPos.add(model.position);

    const screen = toScreen(absPos, camera, w, h);
    if (screen.z > 1) continue; // behind camera

    const isLeft = def.side === 'left';
    const endX = isLeft ? margin : w - margin;
    const endY = isLeft ? leftY : rightY;

    if (isLeft) leftY += yStep;
    else rightY += yStep;

    const canId = calloutCanIds[name] || '';

    // Dot at anchor
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
    ctx.fill();

    // Leader line: anchor -> bend -> horizontal tick
    const bendX = isLeft ? endX + 30 : endX - 30;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(bendX, endY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tick at end
    ctx.beginPath();
    ctx.moveTo(endX, endY - 4);
    ctx.lineTo(endX, endY + 4);
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    const textX = isLeft ? endX - 6 : endX + 6;
    ctx.textAlign = isLeft ? 'right' : 'left';

    ctx.font = '500 11px Helvetica Neue, Helvetica, sans-serif';
    ctx.fillStyle = '#c0c0c0';
    ctx.fillText(name, textX, endY - 6);

    if (canId) {
      ctx.font = '9px Helvetica Neue, Helvetica, sans-serif';
      ctx.fillStyle = '#484848';
      ctx.fillText(canId, textX, endY + 10);
    }
  }
}

/** Manually set fork group by mesh name */
export function setForkGroup(meshName) {
  if (!model) return;
  model.traverse((child) => {
    if (child.name === meshName) {
      forkGroup = child;
      forkBaseY = child.position.y;
      console.log(`Fork group set to: "${meshName}"`);
    }
  });
}
