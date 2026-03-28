/** Tesla-style rolling power consumption graph.
 *
 *  Draw (positive current) fills upward in red/warm tones.
 *  Regen (negative current) fills downward in green.
 *  A thin zero-line sits in the middle.  The graph scrolls left
 *  continuously so you see ~30 seconds of history.
 */

const HISTORY_LEN = 120;          // data points kept (at ~4 Hz = ~30s)
const MAX_CURRENT = 400;          // full-scale amps (clipped beyond this)

const history = new Float32Array(HISTORY_LEN);  // ring buffer
let writeIdx = 0;
let canvas, ctx, w, h;

export function initPowerGraph() {
  canvas = document.getElementById('mc-graph');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  // Use backing-store resolution for sharpness
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  w = rect.width;
  h = rect.height;
}

/** Push a new current sample and redraw. Called from ui.js renderAll(). */
export function pushCurrentSample(amps) {
  history[writeIdx % HISTORY_LEN] = amps;
  writeIdx++;
  draw();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const mid = h * 0.5;           // zero-line Y
  const halfH = mid - 2;         // max pixel excursion from zero

  // Background subtle grid lines at 25% and 75%
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 0.5;
  for (const frac of [0.25, 0.75]) {
    const y = h * frac;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Build path arrays for draw (positive) and regen (negative)
  const step = w / (HISTORY_LEN - 1);
  const oldest = writeIdx >= HISTORY_LEN ? writeIdx - HISTORY_LEN : 0;

  // Draw filled area — positive (draw) region above zero going UP
  ctx.beginPath();
  ctx.moveTo(0, mid);
  for (let i = 0; i < HISTORY_LEN; i++) {
    const idx = (oldest + i) % HISTORY_LEN;
    const val = history[idx];
    const x = i * step;
    if (val > 0) {
      const pxUp = Math.min(val / MAX_CURRENT, 1) * halfH;
      ctx.lineTo(x, mid - pxUp);
    } else {
      ctx.lineTo(x, mid);
    }
  }
  ctx.lineTo(w, mid);
  ctx.closePath();

  // Gradient for draw region: transparent at zero → red at peak
  const drawGrad = ctx.createLinearGradient(0, mid, 0, 0);
  drawGrad.addColorStop(0, 'rgba(160, 0, 32, 0.15)');
  drawGrad.addColorStop(0.4, 'rgba(160, 0, 32, 0.5)');
  drawGrad.addColorStop(1, 'rgba(220, 40, 50, 0.8)');
  ctx.fillStyle = drawGrad;
  ctx.fill();

  // Stroke the top edge of draw area
  ctx.beginPath();
  for (let i = 0; i < HISTORY_LEN; i++) {
    const idx = (oldest + i) % HISTORY_LEN;
    const val = history[idx];
    const x = i * step;
    if (val > 0) {
      const pxUp = Math.min(val / MAX_CURRENT, 1) * halfH;
      if (i === 0) ctx.moveTo(x, mid - pxUp);
      else ctx.lineTo(x, mid - pxUp);
    } else {
      if (i === 0) ctx.moveTo(x, mid);
      else ctx.lineTo(x, mid);
    }
  }
  ctx.strokeStyle = '#A00020';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Regen filled area — negative values going DOWN from zero
  ctx.beginPath();
  ctx.moveTo(0, mid);
  for (let i = 0; i < HISTORY_LEN; i++) {
    const idx = (oldest + i) % HISTORY_LEN;
    const val = history[idx];
    const x = i * step;
    if (val < 0) {
      const pxDown = Math.min(Math.abs(val) / MAX_CURRENT, 1) * halfH;
      ctx.lineTo(x, mid + pxDown);
    } else {
      ctx.lineTo(x, mid);
    }
  }
  ctx.lineTo(w, mid);
  ctx.closePath();

  const regenGrad = ctx.createLinearGradient(0, mid, 0, h);
  regenGrad.addColorStop(0, 'rgba(76, 175, 80, 0.15)');
  regenGrad.addColorStop(0.4, 'rgba(76, 175, 80, 0.5)');
  regenGrad.addColorStop(1, 'rgba(76, 175, 80, 0.8)');
  ctx.fillStyle = regenGrad;
  ctx.fill();

  // Stroke regen edge
  ctx.beginPath();
  for (let i = 0; i < HISTORY_LEN; i++) {
    const idx = (oldest + i) % HISTORY_LEN;
    const val = history[idx];
    const x = i * step;
    if (val < 0) {
      const pxDown = Math.min(Math.abs(val) / MAX_CURRENT, 1) * halfH;
      if (i === 0) ctx.moveTo(x, mid + pxDown);
      else ctx.lineTo(x, mid + pxDown);
    } else {
      if (i === 0) ctx.moveTo(x, mid);
      else ctx.lineTo(x, mid);
    }
  }
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Zero line
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Scale labels
  ctx.font = '8px Helvetica Neue, Helvetica, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#333';
  ctx.fillText(`${MAX_CURRENT}A`, w - 3, 10);
  ctx.fillText(`-${MAX_CURRENT}A`, w - 3, h - 4);
}
