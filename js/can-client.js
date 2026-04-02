/** CAN bus WebSocket client — connects to bridge.py and dispatches events */

const WS_URL = `ws://${location.hostname}:8765`;
const RECONNECT_MS = 2000;

let ws = null;
let reconnectTimer = null;

const canStatus = document.getElementById('can-status');

function setConnected(connected) {
  if (connected) {
    canStatus.className = 'can-connected';
    canStatus.querySelector('.status-dot').className = 'status-dot dot-ok';
    canStatus.querySelector('span:last-child').textContent = 'CAN';
  } else {
    canStatus.className = 'can-disconnected';
    canStatus.querySelector('.status-dot').className = 'status-dot dot-alarm';
    canStatus.querySelector('span:last-child').textContent = 'CAN DISCONNECTED';
  }
}

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    setConnected(true);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);

      // Handle sim status updates from bridge
      if (data.sim_status !== undefined) {
        window.dispatchEvent(new CustomEvent('sim-status', { detail: data.sim_status }));
        return;
      }

      window.dispatchEvent(new CustomEvent('can-data', { detail: data }));
    } catch (e) { /* ignore malformed */ }
  };

  ws.onclose = () => {
    setConnected(false);
    scheduleReconnect();
  };

  ws.onerror = () => {
    setConnected(false);
    ws.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_MS);
}

/** Send a command to the bridge */
export function sendCommand(cmd) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ cmd }));
  }
}

export function initCanClient() {
  connect();
}
