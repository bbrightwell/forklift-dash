# Forklift CAN Bus Dashboard

## Project Overview
Full-screen CAN bus dashboard for the Linde E20 (1252/1254 series) electric counterbalance forklift. Tesla-style dark UI with real-time vehicle visualization and live CAN data. Runs on Raspberry Pi in Chromium kiosk mode.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS — no build step, no npm
- **CAN bridge**: Python (`python-can` + `websockets` + `cantools`) — `can-bridge/bridge.py`
- **DBC decoding**: Real Linde DBC files parsed via cantools for log replay
- **Transport**: WebSocket from Python bridge to browser
- **Runtime**: Chromium kiosk, served over local HTTP (not file://)

## File Structure
```
index.html                     — Main dashboard entry point (production)
style.css                      — All styles, Linde-branded dark theme
start.sh                       — Launch script (bridge + HTTP server + Chromium)
e20.webp                       — Linde E20 reference image
forklift-model-viewer.html     — Photo-based model viewer (reserved, not active)
forklift_dash_concept_v2.html  — Standalone interactive dashboard concept (no deps)
js/
  main.js                      — App entry, boot sequence, SIM toggle wiring
  scene.js                     — Animation loop shell (Three.js removed)
  forklift-model.js            — Fork height API for future model viewer
  can-client.js                — WebSocket client, CAN data handler, sendCommand()
  gauges.js                    — Speed arc, hydraulic gauge (canvas 2D)
  power-graph.js               — Tesla-style rolling power consumption graph
  battery.js                   — Battery SoC/SoH/temp display
  safety-bar.js                — Top safety bar state machine, alarm pulse
  ui.js                        — All data binding, pedal bars, tilt animation
can-bridge/
  bridge.py                    — WebSocket server, live CAN / log replay / idle modes
  decoder.py                   — CAN ID → signal name/value mapping (simple mode)
  log_replayer.py              — Replays session_4.log via cantools DBC decoder
  signals.json                 — CAN signal definitions (arb IDs, scales, offsets)
```

## Development
- Open `forklift_dash_concept_v2.html` directly in a browser — fully self-contained, no server needed
- Or serve with `python3 -m http.server 8080` from project root
- Run bridge: `python3 can-bridge/bridge.py` (auto-detects can0 or idles)
- Or use `./start.sh` which starts both + Chromium
- **SIM toggle**: Click the SIM button in the safety bar to replay the CAN trace log
  (`canbus-analysis-application/logs/session_4.log`) through the DBC decoder.
  Uses real electrical baseline (battery, voltage, temps, hours from the actual truck)
  with animated motion overlay (speed, fork height, tilt, pressure, throttle, brake).

## Center Panel
The center panel `#canvas-wrapper` is **intentionally empty** — reserved for a future
vehicle graphic. A faint Linde script watermark (4% opacity) fills the space. The
`forklift-model-viewer.html` and `e20.webp` files are available when ready.

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

### DBC-decoded signals (log replay mode)
| DBC CAN ID | DBC Signal              | Dashboard Signal   |
|------------|-------------------------|--------------------|
| 0x181      | TruckSpeed              | vehicle_speed      |
| 0x281      | T_Seat, T_motTemp_Lft, T_BatVolt, T_BatCurr | seat_switch, motor_temp, battery_voltage, motor_current |
| 0x282      | LiftHeight, LiftTiltAng | fork_height, tilt_angle |
| 0x304      | TracDirLev              | direction          |
| 0x481      | TruckWorkTime           | hour_meter         |
| 0x48D      | LiIoBMS_SOCwithSOH      | battery_soc        |
| 0x513      | battery_temperature     | battery_temp       |
| 0x21E      | kec_accelerator_pedal_position | throttle    |
| 0x281      | BrakeState              | brake              |

## Conventions
- No build tools, bundlers, or npm packages in the frontend
- Dark theme: #060606 screen, #080808 panels
- Linde brand red: #A00020 — used for speed arc, fork height bar, hydraulic gauge, traction mode, section label borders, safety bar top stripe
- Accent green: #4caf50, amber: #ffb300, alarm red: #f44336
- Key values: #ffffff, secondary text: #c0c0c0
- Section labels have 2px #A00020 left border
- Safety bar: persistent 2px #A00020 top border, alarm state pulses
- Linde cursive signature: white on #A00020 badge (safety bar), 4% watermark (center panel)
- Layout uses flexbox, responsive to window size
