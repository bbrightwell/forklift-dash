/** Arc gauges — speed and hydraulic pressure */

const TAU = Math.PI * 2;

/** Draw the speed arc gauge on #speed-gauge */
export function drawSpeedGauge(mph) {
  const canvas = document.getElementById('speed-gauge');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h - 10;
  const r = 70;
  const startAngle = Math.PI;       // left
  const endAngle = TAU;             // right (180° arc)
  const maxMph = 12;
  const fraction = Math.min(mph / maxMph, 1);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Value arc — gradient red
  if (fraction > 0.005) {
    const valEnd = startAngle + fraction * Math.PI;
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#f44336');
    grad.addColorStop(1, '#ff7043');
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valEnd);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Tick marks
  for (let i = 0; i <= 12; i++) {
    const angle = startAngle + (i / 12) * Math.PI;
    const inner = i % 3 === 0 ? r - 18 : r - 12;
    const outer = r - 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = i % 3 === 0 ? '#444' : '#282828';
    ctx.lineWidth = i % 3 === 0 ? 1.5 : 1;
    ctx.stroke();
  }

  // Number labels at 0, 3, 6, 9, 12
  ctx.font = '200 10px Helvetica Neue, Helvetica, sans-serif';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelR = r - 26;
  for (const val of [0, 3, 6, 9, 12]) {
    const angle = startAngle + (val / 12) * Math.PI;
    ctx.fillText(val.toString(), cx + Math.cos(angle) * labelR, cy + Math.sin(angle) * labelR);
  }
}

/** Draw the hydraulic pressure arc gauge on #hyd-gauge */
export function drawHydGauge(psi) {
  const canvas = document.getElementById('hyd-gauge');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h - 6;
  const r = 48;
  const startAngle = Math.PI;
  const endAngle = TAU;
  const maxPsi = 3000;
  const fraction = Math.min(psi / maxPsi, 1);

  // Background
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Value
  if (fraction > 0.005) {
    const valEnd = startAngle + fraction * Math.PI;
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#4fc3f7');
    grad.addColorStop(1, '#4caf50');
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valEnd);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Ticks at 0, 1000, 2000, 3000
  ctx.font = '9px Helvetica Neue, Helvetica, sans-serif';
  ctx.fillStyle = '#444';
  ctx.textAlign = 'center';
  for (const val of [0, 1000, 2000, 3000]) {
    const angle = startAngle + (val / maxPsi) * Math.PI;
    const inner = r - 12;
    const outer = r - 5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
