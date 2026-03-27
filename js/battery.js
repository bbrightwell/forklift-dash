/** Battery display updates */

export function updateBattery(soc, voltage, temp) {
  const socEl = document.getElementById('batt-soc');
  const voltEl = document.getElementById('batt-voltage');
  const barFill = document.getElementById('batt-soc-bar-fill');
  const tempEl = document.getElementById('batt-temp-val');

  socEl.innerHTML = `${Math.round(soc)}<span class="batt-unit">%</span>`;
  voltEl.textContent = `${voltage.toFixed(1)} V`;
  barFill.style.width = `${Math.max(0, Math.min(100, soc))}%`;
  tempEl.innerHTML = `${Math.round(temp)}&deg;F`;

  // Color thresholds
  barFill.classList.remove('amber', 'red');
  if (soc < 20) barFill.classList.add('red');
  else if (soc < 50) barFill.classList.add('amber');
}

export function updateChargeStatus(charging) {
  const dot = document.getElementById('charge-dot');
  const text = document.getElementById('charge-text');
  if (charging) {
    dot.className = 'status-dot dot-ok charging-anim';
    text.textContent = 'CHARGING';
  } else {
    dot.className = 'status-dot dot-ok';
    text.textContent = 'NOT CHARGING';
  }
}
