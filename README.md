# Linde E20 CAN Bus Dashboard

Full-screen CAN bus dashboard for the **Linde E20 (1252/1254 series)** electric counterbalance forklift. Runs in Chromium on Raspberry Pi 5. Linde-branded dark UI with live CAN data, DBC-decoded signal replay, and Tesla-style power visualization.

---

## Features

- **Three-panel layout**: speed/direction/throttle/power (left), reserved vehicle graphic (center), battery/hydraulics/tilt (right)
- **Safety bar**: deadman switch, mast tilt, hydraulic pressure, load sensor status — alarm state pulses
- **Linde branding**: #A00020 brand red throughout, cursive logo badge, ghost watermark
- **SIM toggle**: replay a real CAN trace log through the DBC decoder with animated motion overlay
- **Tesla-style power graph**: rolling 30-second waveform showing draw (red) and regen (green)
- **Energy consumption graph**: rolling 60-second kWh/h display with amber fill
- **Tilt animation**: SVG fork visualization that rotates to match the live tilt angle
- **Throttle/brake bars**: vertical fill bars tracking accelerator and brake pedal state
- **Live CAN bus**: connects to SocketCAN (`can0`) when available, falls back to idle

---

## Quick Start

No npm or build step required.

### 1. Install Python dependencies

```bash
pip3 install python-can websockets cantools
```

### 2. Launch everything

```bash
./start.sh
```

This starts the CAN bridge, HTTP server, and Chromium. If `can0` is not available, the bridge idles and waits for the SIM toggle.

### 3. Or run manually

```bash
# Terminal 1 — CAN bridge
python3 can-bridge/bridge.py

# Terminal 2 — HTTP server
python3 -m http.server 8080

# Open http://localhost:8080 in a browser
```

### 4. Standalone concept (no server)

Open `forklift_dash_concept_v2.html` directly in a browser — fully self-contained.

---

## SIM Mode

Click the **SIM** button in the safety bar to start replaying the CAN trace log. The replay uses real electrical data from the truck (battery voltage, SOC, temperatures, hour meter) decoded from the Linde DBC files via cantools, with animated motion overlaid for speed, fork height, tilt, throttle, brake, and hydraulic pressure.

The trace log lives at `../canbus-analysis-application/logs/session_4.log` and the DBC files at `../canbus-definitions/`.

---

## Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ #A00020 top stripe ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │
│  SAFETY BAR — DEADMAN · MAST TILT · HYD · LOAD    [CAN] [SIM] Linde│
├──────────────┬────────────────────────────┬──────────────────────────┤
│  LEFT PANEL  │      CENTER PANEL          │      RIGHT PANEL         │
│              │                            │                          │
│  Speed gauge │   (reserved — Linde        │  Battery SOC / voltage   │
│  Direction   │    watermark placeholder)  │  Operating hours / PM    │
│  Traction    │                            │  Hydraulic pressure      │
│  THR / BRK   │   Fork height strip        │  Tilt angle + fork viz   │
│  Power graph │                            │  Charge status           │
│  Stats grid  │                            │                          │
├──────────────┴────────────────────────────┴──────────────────────────┤
│  BOTTOM BAR — LIFT:SLOW · LIFT:FAST · HORN · LIGHTS · SIM ALARM    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
forklift-dash/
├── index.html                      # Main dashboard
├── style.css                       # Linde-branded dark theme
├── start.sh                        # Launch script
├── e20.webp                        # Linde E20 reference image
├── forklift-model-viewer.html      # Photo-based model viewer (reserved)
├── forklift_dash_concept_v2.html   # Standalone concept (no deps)
├── js/
│   ├── main.js                     # Entry point, SIM toggle
│   ├── can-client.js               # WebSocket client + sendCommand()
│   ├── ui.js                       # Data binding, pedal bars, tilt viz
│   ├── gauges.js                   # Speed/hydraulic arc gauges
│   ├── energy-graph.js             # Rolling energy consumption graph (kWh/h)
│   ├── power-graph.js              # Tesla-style rolling power graph
│   ├── battery.js                  # Battery display
│   ├── safety-bar.js               # Safety state machine
│   ├── scene.js                    # Animation loop shell
│   └── forklift-model.js           # Fork height API (future)
└── can-bridge/
    ├── bridge.py                   # WS server: live CAN (20Hz) / log replay / idle
    ├── log_replayer.py             # DBC-decoded log replay + animated overlay
    └── decoder.py                  # DBC-based decoder via cantools
```

---

## CAN Signal Map

| Arb ID | Signal | Unit | Scale | Offset |
|--------|--------|------|-------|--------|
| 0x0C0 | vehicle_speed | mph | 0.01 | 0 |
| 0x190 | direction | enum | 1 | 0 |
| 0x205 | fork_height | inches | 0.1 | 0 |
| 0x182 | hyd_torque | Nm | via DBC | 0 |
| 0x215 | tilt_angle | degrees | 0.1 | -10 |
| 0x300 | seat_switch | bool | 1 | 0 |
| 0x620 | battery_soc | % | 0.5 | 0 |
| 0x621 | battery_voltage | V | 0.1 | 0 |
| 0x625 | battery_temp | °F | 0.1 | -40 |
| 0x1D4 | motor_current | A | 0.1 | -1000 |
| 0x1E0 | motor_temp | °F | 0.5 | 0 |
| 0x700 | hour_meter | h | 0.1 | 0 |

---

## Design Tokens

| Token | Value |
|---|---|
| Screen background | `#060606` |
| Panel background | `#080808` |
| Border | `0.5px solid #161616` |
| Linde brand red | `#A00020` |
| Accent green | `#4caf50` |
| Accent amber | `#ffb300` |
| Alarm red | `#f44336` |
| Key values | `#ffffff` |
| Secondary text | `#c0c0c0` |
| Font | Helvetica Neue, Helvetica, sans-serif |

---

## Live CAN Bus Setup

```bash
# Bring up CAN interface
sudo ip link set can0 up type can bitrate 500000

# Verify traffic
candump can0

# The bridge auto-detects can0 on startup
./start.sh
```

---

## Auto-Start (systemd)

See `start.sh` for the combined launcher. For production, create systemd units for the CAN bridge, web server, and Chromium kiosk individually.
