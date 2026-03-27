/** UI update functions — bind CAN data to DOM elements */

import { drawSpeedGauge, drawHydGauge } from './gauges.js';
import { updateBattery } from './battery.js';
import { setSafetyZone } from './safety-bar.js';
import { setForkHeight } from './forklift-model.js';

// Current state — initialised with plausible defaults
const state = {
  speed: 0,
  direction: 0,      // 0=N, 1=F, 2=R
  fork_height: 0,
  hyd_pressure: 850,
  tilt_angle: 0,
  seat_switch: 1,     // 1=SEATED
  battery_soc: 72,
  battery_voltage: 48.2,
  battery_temp: 92,
  motor_current: 0,
  motor_temp: 142,
  hour_meter: 4218.3,
};

const DIR_MAP = { 0: 'N', 1: 'F', 2: 'R' };
const PM_INTERVAL = 500; // hours

export function initUI() {
  // Initial render
  renderAll();

  // Listen for CAN data
  window.addEventListener('can-data', (e) => {
    const d = e.detail;
    if (d.vehicle_speed !== undefined) state.speed = d.vehicle_speed;
    if (d.direction !== undefined) state.direction = d.direction;
    if (d.fork_height !== undefined) state.fork_height = d.fork_height;
    if (d.hyd_pressure !== undefined) state.hyd_pressure = d.hyd_pressure;
    if (d.tilt_angle !== undefined) state.tilt_angle = d.tilt_angle;
    if (d.seat_switch !== undefined) state.seat_switch = d.seat_switch;
    if (d.battery_soc !== undefined) state.battery_soc = d.battery_soc;
    if (d.battery_voltage !== undefined) state.battery_voltage = d.battery_voltage;
    if (d.battery_temp !== undefined) state.battery_temp = d.battery_temp;
    if (d.motor_current !== undefined) state.motor_current = d.motor_current;
    if (d.motor_temp !== undefined) state.motor_temp = d.motor_temp;
    if (d.hour_meter !== undefined) state.hour_meter = d.hour_meter;
    renderAll();
  });
}

function renderAll() {
  // Speed gauge
  drawSpeedGauge(state.speed);
  document.getElementById('speed-value').textContent = state.speed.toFixed(1);

  // Direction
  document.querySelectorAll('#direction-indicator .pill').forEach(p => {
    const d = p.dataset.dir;
    const active = d === DIR_MAP[state.direction];
    p.classList.toggle('active', active);
  });

  // Motor current bar
  const current = state.motor_current;
  const maxCurrent = 500;
  const mcVal = document.getElementById('mc-value');
  const mcRegen = document.getElementById('mc-regen');
  const mcDraw = document.getElementById('mc-draw');
  mcVal.textContent = `${Math.abs(current).toFixed(0)} A`;
  if (current < 0) {
    // Regen
    mcRegen.style.width = `${Math.min(Math.abs(current) / maxCurrent * 50, 50)}%`;
    mcDraw.style.width = '0';
  } else {
    mcRegen.style.width = '0';
    mcDraw.style.width = `${Math.min(current / maxCurrent * 50, 50)}%`;
  }

  // Motor temp
  document.getElementById('motor-temp-val').innerHTML = `${Math.round(state.motor_temp)}&deg;F`;

  // Hours
  const totalH = state.hour_meter;
  const nextSvc = PM_INTERVAL - (totalH % PM_INTERVAL);
  document.getElementById('total-hours-val').textContent = totalH.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  document.getElementById('next-svc-val').textContent = `${nextSvc.toFixed(1)} h`;
  document.getElementById('op-total-val').textContent = `${totalH.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} h`;
  document.getElementById('op-next-val').textContent = `${nextSvc.toFixed(1)} h`;

  // PM progress bar
  const pmProgress = ((PM_INTERVAL - nextSvc) / PM_INTERVAL) * 100;
  document.getElementById('pm-bar-fill').style.width = `${pmProgress}%`;

  // Battery
  updateBattery(state.battery_soc, state.battery_voltage, state.battery_temp);

  // Hydraulic gauge
  drawHydGauge(state.hyd_pressure);
  document.getElementById('hyd-psi-value').innerHTML = `${Math.round(state.hyd_pressure)}<span class="hyd-unit"> PSI</span>`;

  // Tilt
  const tiltAbs = Math.abs(state.tilt_angle);
  const tiltDir = state.tilt_angle > 0.1 ? 'BACK' : state.tilt_angle < -0.1 ? 'FORWARD' : 'NEUTRAL';
  document.getElementById('tilt-value').innerHTML = `${tiltAbs.toFixed(1)}&deg;`;
  document.getElementById('tilt-dir').textContent = tiltDir;

  // Safety bar — tilt
  if (tiltAbs > 8) {
    setSafetyZone('tilt', 'alarm', `${tiltAbs.toFixed(1)}°`);
  } else if (tiltAbs > 5) {
    setSafetyZone('tilt', 'warn', `${tiltAbs.toFixed(1)}°`);
  } else {
    setSafetyZone('tilt', 'ok', `${tiltAbs.toFixed(1)}°`);
  }

  // Safety bar — pressure
  if (state.hyd_pressure > 2800) {
    setSafetyZone('pressure', 'alarm', `${Math.round(state.hyd_pressure)} PSI`);
  } else if (state.hyd_pressure > 2500) {
    setSafetyZone('pressure', 'warn', `${Math.round(state.hyd_pressure)} PSI`);
  } else {
    setSafetyZone('pressure', 'ok', `${Math.round(state.hyd_pressure)} PSI`);
  }

  // Safety bar — deadman
  if (state.seat_switch === 0) {
    setSafetyZone('deadman', 'alarm', 'VACANT');
  } else {
    setSafetyZone('deadman', 'ok', 'SEATED');
  }

  // Fork height
  setForkHeight(state.fork_height);
  const forkPct = (state.fork_height / 240) * 100;
  document.getElementById('fork-progress-fill').style.width = `${Math.min(forkPct, 100)}%`;
  document.getElementById('fork-height-value').textContent = `${state.fork_height.toFixed(1)}"`;

  // Fork status badge
  const badge = document.getElementById('fork-status-badge');
  if (state.fork_height > 24) {
    badge.textContent = 'INTERLOCK ACTIVE';
    badge.className = 'badge badge-alarm';
  } else if (state.fork_height > 8) {
    badge.textContent = 'RAISED';
    badge.className = 'badge badge-warn';
  } else {
    badge.textContent = 'TRAVEL OK';
    badge.className = 'badge badge-ok';
  }
}

export function getState() { return { ...state }; }
