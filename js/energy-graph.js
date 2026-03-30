/** Tesla-style rolling energy consumption graph.
 *
 *  Fills upward in amber tones showing energy draw in kWh/h.
 *  A thin zero-line sits at the bottom. The graph scrolls left
 *  continuously showing ~60 seconds of history.
 */

const HISTORY_LEN = 300;          // data points kept (~60s at 5Hz effective)
const MAX_KWH = 10;              // full-scale kWh/h

const history = new Float32Array(HISTORY_LEN);
let writeIdx = 0;
let canvas, ctx, w, h;

export function initEnergyGraph() {
  canvas = document.getElementById('energy-graph');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  w = rect.width;
  h = rect.height;
}

/** Push a new energy sample and redraw. */
export function pushEnergySample(kwh) {
  history[writeIdx % HISTORY_LEN] = kwh;
  writeIdx++;
  draw();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const bottom = h - 12;         // leave room for scale label
  const top = 4;
  const graphH = bottom - top;

  // Subtle grid lines at 25%, 50%, 75%
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 0.5;
  for (const frac of [0.25, 0.5, 0.75]) {
    const y = bottom - frac * graphH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const step = w / (HISTORY_LEN - 1);
  const oldest = writeIdx >= HISTORY_LEN ? writeIdx - HISTORY_LEN : 0;

  // Filled area
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let i = 0; i < HISTORY_LEN; i++) {
    const idx = (oldest + i) % HISTORY_LEN;
    const val = history[idx];
    const x = i * step;
    const pxUp = Math.min(Math.max(val, 0) / MAX_KWH, 1) * graphH;
    ctx.lineTo(x, bottom - pxUp);
  }
  ctx.lineTo(w, bottom);
  ctx.closePath();

  // Amber gradient
  const grad = ctx.createLinearGradient(0, bottom, 0, top);
  grad.addColorStop(0, 'rgba(255, 179, 0, 0.08)');
  grad.addColorStop(0.3, 'rgba(255, 179, 0, 0.25)');
  grad.addColorStop(0.7, 'rgba(255, 179, 0, 0.5)');
  grad.addColorStop(1, 'rgba(255, 179, 0, 0.8)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke top edge
  ctx.beginPath();
  for (let i = 0; i < HISTORY_LEN; i++) {
    const idx = (oldest + i) % HISTORY_LEN;
    const val = history[idx];
    const x = i * step;
    const pxUp = Math.min(Math.max(val, 0) / MAX_KWH, 1) * graphH;
    if (i === 0) ctx.moveTo(x, bottom - pxUp);
    else ctx.lineTo(x, bottom - pxUp);
  }
  ctx.strokeStyle = '#ffb300';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Zero line
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  ctx.lineTo(w, bottom);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Scale labels
  ctx.font = '8px Helvetica Neue, Helvetica, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#333';
  ctx.fillText(`${MAX_KWH}`, w - 3, top + 8);
  ctx.fillText('0', w - 3, bottom - 2);

  // Current value (latest sample)
  const latest = history[(writeIdx - 1 + HISTORY_LEN) % HISTORY_LEN];
  ctx.font = '300 14px Helvetica Neue, Helvetica, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = latest > 5 ? '#ffb300' : '#c0c0c0';
  ctx.fillText(`${latest.toFixed(1)} kWh/h`, 6, top + 14);
}
