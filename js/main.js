/** Application entry point */

import { initScene } from './scene.js';
import { loadForkliftModel } from './forklift-model.js';
import { initCanClient, sendCommand } from './can-client.js';
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

// SIM toggle button
const simBtn = document.getElementById('btn-sim-toggle');
let simActive = false;

simBtn.addEventListener('click', () => {
  if (simActive) {
    sendCommand('stop_sim');
  } else {
    sendCommand('start_sim');
  }
});

// Listen for sim status updates from bridge
window.addEventListener('sim-status', (e) => {
  simActive = e.detail;
  simBtn.classList.toggle('active', simActive);
  simBtn.querySelector('.sim-label').textContent = simActive ? 'SIM ON' : 'SIM';
});

// Traction mode buttons (local UI only)
document.querySelectorAll('.pill-mode').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill-mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// EXIT button — closes the tab or navigates to blank page
document.getElementById('btn-exit').addEventListener('click', () => {
  if (confirm('Exit Forklift Dashboard?')) {
    window.close();
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#060606;color:#555;font-family:sans-serif;font-size:18px;">Dashboard closed. You can close this tab.</div>';
  }
});

console.log('Forklift Dashboard started');
