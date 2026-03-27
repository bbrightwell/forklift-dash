/** Application entry point */

import { initScene } from './scene.js';
import { loadForkliftModel } from './forklift-model.js';
import { initCanClient } from './can-client.js';
import { initUI } from './ui.js';
import { triggerSimAlarm } from './safety-bar.js';

// Boot sequence
initScene();
loadForkliftModel();
initCanClient();
initUI();

// SIM ALARM button
document.getElementById('btn-sim-alarm').addEventListener('click', () => {
  triggerSimAlarm(3000);
});

// Traction mode buttons (local UI only)
document.querySelectorAll('.pill-mode').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill-mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

console.log('Forklift Dashboard started');
