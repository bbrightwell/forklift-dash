# Forklift CAN Bus Dashboard

## Project Overview
Full-screen CAN bus dashboard for the Linde 1252/1254 electric counterbalance forklift. Tesla-style dark UI with real-time vehicle visualization and live CAN data. Runs on Raspberry Pi in Chromium kiosk mode.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS — no build step, no npm
- **Model viewer**: `forklift-model-viewer.html` — reference photograph as base image, animated SVG fork/carriage overlay. Public API: `window.LindeModel.setForkHeight(inches)`
- **CAN bridge**: Python (`python-can` + `websockets`) — `can-bridge/bridge.py`
- **Transport**: WebSocket from Python bridge to browser
- **Runtime**: Chromium kiosk, served over local HTTP (not file://)

## File Structure
```
forklift_dash_concept_v2.html  — Standalone interactive dashboard concept (no deps)
forklift-model-viewer.html     — Photo-based model viewer, animated SVG forks
index.html                     — Main dashboard entry point (production)
style.css                      — All styles, responsive (100vw/100vh)
start.sh                       — Launch script (bridge + HTTP server + Chromium)
js/
  main.js                      — App entry, boot sequence
  scene.js                     — Three.js scene, camera, lighting (production shell)
  forklift-model.js            — Calls window.LindeModel.setForkHeight() for fork animation
  can-client.js                — WebSocket client, CAN data handler
  gauges.js                    — Speed arc, hydraulic gauge (canvas 2D)
  battery.js                   — Battery SoC/SoH/temp display
  safety-bar.js                — Top safety bar state machine
  ui.js                        — Bottom bar, direction/mode pills, data binding
can-bridge/
  bridge.py                    — python-can → WebSocket server (--simulate flag for dev)
  decoder.py                   — CAN ID → signal name/value mapping
  signals.json                 — CAN signal definitions (arb IDs, scales, offsets)
```

Note: `forklift.glb` has been removed from the repo and is excluded via `.gitignore`.
The center panel now uses `forklift-model-viewer.html` instead of a Three.js GLB scene.

## Development
- Open `forklift_dash_concept_v2.html` directly in a browser — fully self-contained, no server needed
- Or serve with `python3 -m http.server 8080` from project root
- Run bridge in simulation: `python3 can-bridge/bridge.py --simulate`
- Or use `./start.sh` which starts both + Chromium kiosk

## Model Viewer Integration
The fork height animation is driven through a public API on `forklift-model-viewer.html`:

```js
window.LindeModel.setForkHeight(inches); // 0–240 inches
```

Wire this to the decoded CAN signal from ID `0x205` in `js/forklift-model.js`.

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
- Dark theme (#080808 base), accent blue (#4fc3f7), green (#4caf50), amber (#ffb300), red (#f44336)
- Linde brand red: #C82418
- Layout uses flexbox, responsive to window size
