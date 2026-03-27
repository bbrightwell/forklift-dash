# Forklift CAN Bus Dashboard

## Project Overview
Full-screen CAN bus dashboard for electric forklifts. Tesla-style dark UI with real-time 3D vehicle visualization and live CAN data. Runs on Raspberry Pi 5 in Chromium kiosk mode.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS — no build step, no npm
- **3D**: Three.js via CDN importmap (v0.160.0), GLTFLoader for `forklift.glb`
- **CAN bridge**: Python (`python-can` + `websockets`) — `can-bridge/bridge.py`
- **Transport**: WebSocket from Python bridge to browser
- **Runtime**: Chromium kiosk, served over local HTTP (not file://)

## File Structure
```
index.html          — Main dashboard (single page)
style.css           — All styles, responsive (100vw/100vh)
forklift.glb        — 3D forklift model (~32MB, CC BY 4.0)
start.sh            — Launch script (bridge + HTTP server + Chromium)
js/
  main.js           — App entry, boot sequence
  scene.js          — Three.js scene, camera, lighting, OrbitControls
  forklift-model.js — GLB loader, fork height animation, 2D callout overlay
  can-client.js     — WebSocket client, CAN data handler
  gauges.js         — Speed arc, hydraulic gauge (canvas 2D)
  battery.js        — Battery SoC/SoH/temp display
  safety-bar.js     — Top safety bar state machine
  ui.js             — Bottom bar, direction/mode pills, data binding
can-bridge/
  bridge.py         — python-can → WebSocket server (--simulate flag for dev)
  decoder.py        — CAN ID → signal name/value mapping
  signals.json      — CAN signal definitions (arb IDs, scales, offsets)
```

## Development
- Serve with `python3 -m http.server 8080` from project root (file:// breaks GLB loading)
- Run bridge separately: `python3 can-bridge/bridge.py --simulate`
- Or use `./start.sh` which starts both + Chromium kiosk

## Key CAN Signals
| Arb ID | Signal          | Unit    |
|--------|-----------------|---------|
| 0x0C0  | vehicle_speed   | mph     |
| 0x190  | direction       | enum    |
| 0x205  | fork_height     | inches  |
| 0x210  | hyd_pressure    | PSI     |
| 0x215  | tilt_angle      | degrees |
| 0x300  | seat_switch     | bool    |
| 0x620  | battery_soc     | %       |
| 0x621  | battery_voltage | V       |
| 0x625  | battery_temp    | °F      |
| 0x1D4  | motor_current   | A       |
| 0x1E0  | motor_temp      | °F      |
| 0x700  | hour_meter      | h       |

## Conventions
- No build tools, bundlers, or npm packages in the frontend
- All Three.js imports via CDN importmap in index.html
- Dark theme (#080808 base), accent blue (#4fc3f7), green (#4caf50), amber (#ffb300), red (#f44336)
- Layout uses flexbox, responsive to window size
- 3D model callouts rendered on a 2D canvas overlay synced to the Three.js camera
