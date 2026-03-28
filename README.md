# Linde 1252 CAN Bus Dashboard

Full-screen CAN bus dashboard for the **Linde 1252/1254** electric counterbalance forklift. Runs in Chromium kiosk mode on Raspberry Pi. Tesla-style dark UI with live CAN data and an animated forklift model viewer.

---

## Status

> **In development — visual layer complete, CAN wiring in progress**

| File | Purpose | State |
|---|---|---|
| `forklift_dash_concept_v2.html` | Full interactive dashboard — standalone, no dependencies | ✅ Active |
| `forklift-model-viewer.html` | Photo-based model viewer, animated SVG fork overlay | ✅ Active |
| `can-bridge/bridge.py` | Python CAN → WebSocket bridge | 🔧 Pending CAN wiring |
| `can-bridge/decoder.py` | CAN ID → signal decoder | 🔧 Pending signal map |
| `can-bridge/signals.json` | CAN signal definitions | 🔧 Pending |

---

## Quick Start (Development)

No npm or build step required.

### 1. Install Python dependencies

```bash
pip3 install python-can websockets
```

### 2. Start the CAN bridge in simulation mode

```bash
cd can-bridge
python3 bridge.py --simulate
```

### 3. Serve the dashboard

```bash
python3 -m http.server 8080
```

### 4. Open in browser

```
http://localhost:8080
```

Or open `forklift_dash_concept_v2.html` directly as a file — it's fully self-contained, no server needed.

---

## Live CAN Bus Setup

```bash
# Bring up CAN interface
sudo ip link set can0 up type can bitrate 250000

# Verify traffic
candump can0

# Run the bridge in live mode
cd can-bridge
python3 bridge.py
```

---

## Model Viewer

The center panel embeds `forklift-model-viewer.html` — a fixed-perspective viewer built from the actual Linde 1252 reference photograph, with an SVG fork/carriage group overlaid and animated vertically against the masked photograph.

**Public API:**

```js
// Wire to CAN ID 0x205 — accepts 0–240 inches
window.LindeModel.setForkHeight(48);
```

Fork travel maps 0–240 inches to mast travel in SVG units. The viewer is ready for CAN integration.

---

## Dashboard Layout

```
┌──────────────────────────────────────────────────────────────┐
│  SAFETY BAR (44px) — DEADMAN · MAST TILT · HYD · LOAD      │
├────────────┬───────────────────────────────┬─────────────────┤
│            │                               │                 │
│  LEFT      │       CENTER PANEL            │  RIGHT PANEL    │
│            │   forklift-model-viewer.html  │                 │
│  Speed     │   (photo + SVG fork overlay)  │  Battery hero   │
│  Direction │                               │  Hours / PM     │
│  Mode      │   Fork height bar + slider    │  Hydraulics     │
│  Amps      │                               │  Tilt angle     │
│  Temps     │                               │  Charge status  │
│            │                               │                 │
├────────────┴───────────────────────────────┴─────────────────┤
│  BOTTOM BAR — LIFT:SLOW · LIFT:FAST · HORN · LIGHTS         │
└──────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
forklift-dash/
├── forklift_dash_concept_v2.html   # Standalone interactive dashboard concept
├── forklift-model-viewer.html      # Photo-based model viewer (center panel)
├── index.html                      # Main dashboard entry point (production)
├── style.css
├── start.sh
├── js/
│   ├── main.js
│   ├── can-client.js
│   ├── scene.js
│   ├── forklift-model.js           # Will call window.LindeModel.setForkHeight()
│   ├── gauges.js
│   ├── battery.js
│   ├── safety-bar.js
│   └── ui.js
└── can-bridge/
    ├── bridge.py
    ├── decoder.py
    └── signals.json
```

---

## CAN Signal Map

| Arb ID | Signal | Unit | Scale | Offset |
|--------|--------|------|-------|--------|
| 0x0C0 | vehicle_speed | mph | 0.01 | 0 |
| 0x190 | direction | enum | 1 | 0 |
| 0x205 | fork_height | inches | 0.1 | 0 |
| 0x210 | hyd_pressure | PSI | 1.0 | 0 |
| 0x215 | tilt_angle | degrees | 0.1 | -10 |
| 0x300 | seat_switch | bool | 1 | 0 |
| 0x620 | battery_soc | % | 0.5 | 0 |
| 0x621 | battery_voltage | V | 0.1 | 0 |
| 0x625 | battery_temp | °F | 0.1 | -40 |
| 0x1D4 | motor_current | A | 0.1 | -1000 |
| 0x1E0 | motor_temp | °F | 0.5 | 0 |
| 0x700 | hour_meter | h | 0.1 | 0 |

> These IDs are representative. Confirm byte layouts against live `candump` output before relying on them.

---

## Chromium Kiosk Mode

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-translate --no-first-run \
  --disk-cache-dir=/tmp/chromium-cache \
  http://localhost:8080
```

---

## Auto-Start (systemd)

### CAN bridge

`/etc/systemd/system/forklift-can.service`:

```ini
[Unit]
Description=Forklift CAN-to-WebSocket Bridge
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/forklift-dash/can-bridge
ExecStart=/usr/bin/python3 bridge.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Web server

`/etc/systemd/system/forklift-web.service`:

```ini
[Unit]
Description=Forklift Dashboard Web Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/forklift-dash
ExecStart=/usr/bin/python3 -m http.server 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Kiosk

`/etc/systemd/system/forklift-kiosk.service`:

```ini
[Unit]
Description=Forklift Dashboard Kiosk
After=forklift-web.service forklift-can.service graphical.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 5
ExecStart=/usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-translate --no-first-run \
  --disk-cache-dir=/tmp/chromium-cache http://localhost:8080
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable forklift-can forklift-web forklift-kiosk
sudo systemctl start forklift-can forklift-web forklift-kiosk
```

---

## Design Tokens

| Token | Value |
|---|---|
| Background | `#080808` |
| Panel | `#0b0b0b` |
| Border | `0.5px solid #161616` |
| Accent blue | `#4fc3f7` |
| Accent green | `#4caf50` |
| Accent amber | `#ffb300` |
| Accent red | `#f44336` |
| Linde red | `#C82418` |
| Font | Helvetica Neue, Helvetica, sans-serif |

---

## Roadmap

- [x] Dashboard concept UI (safety bar, gauges, battery panel)
- [x] Fork height bar with interlock badge
- [x] Photo-based model viewer with animated SVG fork overlay
- [ ] Wire `setForkHeight()` to live CAN 0x205
- [ ] Full CAN bridge integration across all signals
- [ ] Systemd autostart services
- [ ] Operator login / settings screen
