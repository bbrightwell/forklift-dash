/** Safety bar state management */

// States: 'ok', 'warn', 'alarm'
const zoneStates = {
  deadman:  'ok',
  tilt:     'ok',
  pressure: 'ok',
  load:     'disabled',
};

function dotClass(state) {
  return `status-dot dot-${state}`;
}

export function setSafetyZone(zone, state, value) {
  if (zone === 'load') return; // always disabled
  zoneStates[zone] = state;

  const el = document.getElementById(`sz-${zone}`);
  if (!el) return;

  const dot = el.querySelector('.status-dot');
  const valEl = el.querySelector('.sz-value');
  dot.className = dotClass(state);
  if (value !== undefined) valEl.textContent = value;

  updateBarBackground();
}

function updateBarBackground() {
  const bar = document.getElementById('safety-bar');
  const states = Object.values(zoneStates);

  if (states.includes('alarm')) {
    bar.className = 'alarm';
  } else if (states.includes('warn')) {
    bar.className = 'warn';
  } else {
    bar.className = '';
  }
}

/** Trigger a simulated alarm sequence */
export function triggerSimAlarm(durationMs = 3000) {
  setSafetyZone('deadman', 'alarm', 'VACANT');
  setTimeout(() => {
    setSafetyZone('deadman', 'ok', 'SEATED');
  }, durationMs);
}

export function getSafetyState() {
  return { ...zoneStates };
}
