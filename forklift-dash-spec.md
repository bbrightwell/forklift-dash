# Forklift CAN Bus Dashboard — Project Specification

## Overview

A full-screen vehicle dashboard application running on a Raspberry Pi connected to a battery electric forklift's CAN bus networks. The display mimics the visual style and layout philosophy of Tesla vehicle UI — dark theme, persistent safety bar, rich vehicle visualization in the center panel, and live CAN bus data throughout.

---

## Hardware

| Item | Detail |
|---|---|
| Computer | Raspberry Pi (any model with USB/GPIO) |
| Display | 1920×1080, landscape, touchscreen |
| CAN interface | USB-to-CAN adapter (e.g. Canable, PCAN-USB) or Pi HAT |
| Vehicle | Battery electric counterbalance forklift |
| Browser | Chromium in kiosk mode (`--kiosk --app=http://localhost:3000`) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML / CSS / JavaScript (vanilla) |
| 3D rendering | Three.js (GLTFLoader for forklift model) |
| CAN bus bridge | Python + `python-can` library |
| Data transport | WebSocket (Python server → browser client) |
| Runtime | Chromium kiosk mode on Raspberry Pi OS |

### File structure

```
forklift-dash/
├── index.html              # Main dashboard entry point
├── style.css               # Global styles
├── forklift.glb            # 3D model (download from Sketchfab)
├── js/
│   ├── main.js             # App init, layout orchestration
│   ├── can-client.js       # WebSocket client, CAN data handler
│   ├── scene.js            # Three.js scene, camera, lighting
│   ├── forklift-model.js   # GLB loader, fork animation, callouts
│   ├── gauges.js           # Speed arc, power/regen bar
│   ├── battery.js          # Battery SoC, SoH, temp display
│   ├── safety-bar.js       # Top bar state machine
│   └── ui.js               # Bottom bar, mode buttons, direction
├── can-bridge/
│   ├── bridge.py           # python-can → WebSocket server
│   ├── decoder.py          # CAN ID → signal name/value mapping
│   └── signals.json        # CAN signal definitions
└── README.md
```

---

## Layout — 1920×1080 Landscape

```
┌──────────────────────────────────────────────────────────────┐
│  SAFETY BAR (44px) — always visible, full width             │
│  [DEADMAN] [MAST TILT] [HYD PRESSURE] [LOAD SENSOR]  10:24  │
├──────────┬───────────────────────────────┬───────────────────┤
│          │                               │                   │
│  LEFT    │       CENTER PANEL            │   RIGHT PANEL     │
│  PANEL   │   Three.js forklift model     │                   │
│  190px   │   full GLB render             │   240px           │
│          │   Tesla-style callout lines   │                   │
│  Speed   │   Fork height strip           │   Battery hero    │
│  gauge   │   (slider for dev/demo)       │   Hours / PM      │
│  Dir     │                               │   Hydraulics      │
│  Mode    │                               │   Tilt angle      │
│  Amps    │                               │   Charge status   │
│  Temps   │                               │                   │
├──────────┴───────────────────────────────┴───────────────────┤
│  BOTTOM BAR (46px) — touchscreen action strip               │
│  [LIFT:SLOW] [LIFT:FAST]  [HORN] [LIGHTS]     [OP: J.DAVIS] │
└──────────────────────────────────────────────────────────────┘
```

---

## Safety Bar (Top — always visible)

The safety bar is the most critical UI element. It spans the full width and changes background color based on the worst active state across all zones.

| State | Bar background | Dot |
|---|---|---|
| All clear | `#040e06` (very dark green) | Solid green |
| Warning | `#0e0a00` (very dark amber) | Blinking amber |
| Alarm | `#0e0404` (very dark red) | Fast blinking red |

### Safety zones (left to right)

| Zone | CAN ID | States | Tap behavior |
|---|---|---|---|
| DEADMAN (seat switch) | `0x300` | SEATED / VACANT ⚠ | Tap to simulate in dev |
| MAST TILT | `0x215` | X.X° BACK / LEVEL / FWD ⚠ | Tap to cycle |
| HYD PRESSURE | `0x210` | X,XXX PSI / high / over ⚠ | Tap to cycle |
| LOAD SENSOR | N/A | NOT FITTED (greyed) | None |

---

## Left Panel

| Element | Detail |
|---|---|
| Speed arc gauge | 0–12 mph, red arc (#C82418 Linde red), live from CAN |
| Direction indicator | F / N / R buttons — tap to simulate, live from CAN |
| Traction mode | ECO / STD / PWR — tap to set, live from CAN |
| Motor current bar | Bidirectional: regen (green, left) ↔ draw (blue, right) |
| Motor temp | Color: green <130°F, amber 130–160°F, red >160°F |
| Controller temp | Same thresholds as motor |
| Total hours | Live from hourmeter CAN |
| Next service | Countdown hours, amber when <50h remaining |

---

## Center Panel — Three.js Forklift Visualization

### 3D model

- **File:** `forklift.glb` — sourced from Sketchfab (Arsen Ismailov, CC Attribution)
- **URL:** https://sketchfab.com/3d-models/forklift-bdb03db7036e436286f4e2fd34c02a89
- **Triangles:** 11,100 — lightweight, suitable for Pi at 60fps
- **Credit required:** "3D model by Arsen Ismailov / Sketchfab (CC BY)"

### Camera setup

- Position: `(2.8, 1.6, 3.2)` — 3/4 front-left view
- Target: `(0, 0.8, 0)` — centre of mass height
- FOV: 45°, near: 0.1, far: 100
- OrbitControls disabled in production, enabled in dev mode

### Lighting

```js
// Key light (warm, from upper front-left)
directionalLight: position (3, 4, 3), intensity 1.2, color #fff5e8

// Fill light (cool, from right)
directionalLight: position (-2, 2, -1), intensity 0.4, color #e8f0ff

// Ambient
ambientLight: intensity 0.35, color #ffffff

// Ground bounce
hemisphereLight: sky #b0c8ff, ground #3a2a1a, intensity 0.3
```

### Fork animation

The fork carriage group (identified by mesh name in the GLB) is translated on the Y axis based on the live height value from CAN `0x205`. Map the encoder count range to a Y offset in Three.js units.

```js
// Pseudocode
const heightPct = canHeightValue / MAX_ENCODER_COUNT;
forkCarriageGroup.position.y = heightPct * MAST_HEIGHT_UNITS;
```

### Tesla-style callout lines

Callout lines are drawn in a 2D canvas overlay positioned absolutely over the Three.js canvas. Each callout:

1. Projects the 3D world point to screen coords via `vector.project(camera)`
2. Draws a dot at the projected point
3. Draws a diagonal line to a horizontal tick
4. Renders label text + CAN ID below

| Callout | 3D anchor point | Color | Data shown |
|---|---|---|---|
| MAST | Top of mast | `#4fc3f7` | CAN 0x205 |
| DEADMAN | Seat position | `#4caf50` (green when ok) | SEATED / VACANT |
| FORKS | Fork blade mid | `#4fc3f7` | Height in inches |
| TILT ANGLE | Tilt cylinder | `#ffb300` | X.X° direction |
| BATTERY | Hood panel | `#4caf50` | SoC% · voltage |
| HYDRAULICS | Pump area | `#4fc3f7` | PSI |
| COUNTERWEIGHT | CW casting | `#4fc3f7` | 5,500 lb |
| OVERHEAD GUARD | ROPS bar | `#4fc3f7` | ROPS certified |
| DRIVE AXLE | Front hub | `#4fc3f7` | CAN 0x0C0 |
| STEER AXLE | Rear hub | `#4fc3f7` | CAN 0x3D0 |

### Fork height strip

Below the 3D viewport — a horizontal progress bar showing fork height:

```
FORK HEIGHT  [████░░░░░░░░░░░░░░░░]  48"  / 240"  [TRAVEL OK]
```

Status badge states:
- `≤ 8"` → green · TRAVEL OK
- `9–24"` → amber · RAISED
- `> 24"` → red · INTERLOCK ACTIVE

---

## Right Panel

### Battery hero section

Occupies the top ~40% of the right panel.

```
BATTERY
[78%]  [52.4 V PACK VOLTAGE]
[████████████████░░░░░]  ← SoC bar, color = green/amber/red
89°F  |  94% SoH  |  312 cycles  |  20% min threshold
```

Battery state color thresholds:

| Lead-acid | Lithium-ion | Color |
|---|---|---|
| > 50% | > 40% | Green `#4caf50` |
| 20–50% | 15–40% | Amber `#ffb300` |
| < 20% | < 15% | Red `#f44336` (+ alarm) |

Lead-acid shows additional warning: `⚠ SULFATION RISK` below 20%.

### Hours / PM section

```
3,847 h          43 h
TOTAL HOURS      NEXT SERVICE
[████████████████░░░░]  PM at 3,890 h · 250h interval
```

### Hydraulic pressure

Small arc gauge + numeric readout. Max 3,000 PSI. Warning at >2,500 PSI.

### Tilt angle

Large numeric readout. `3.2° BACK` is normal travel position. Warning if forward tilt while moving.

### Charge status

When charger connected: animated green dot + "Charging · X.X kW · Xh to full". When disconnected: grey dot + "Not charging".

---

## Bottom Bar — Touchscreen Action Strip

| Button | Action |
|---|---|
| LIFT: SLOW | Set hydraulic flow rate to slow mode |
| LIFT: FAST | Set hydraulic flow rate to fast mode |
| HORN | Trigger horn output (GPIO or CAN) |
| LIGHTS | Toggle headlights / work lights |
| SIM ALARM | (dev only) Simulate seat-vacant alarm |
| SETTINGS | Open settings overlay |
| OP: [NAME] | Shows logged-in operator name |

---

## CAN Bus Bridge (Python)

### Setup

```bash
pip install python-can websockets
```

### CAN interface init

```python
import can
bus = can.interface.Bus(channel='can0', bustype='socketcan')
# or for USB adapter:
bus = can.interface.Bus(channel='COM3', bustype='slcan')
```

### Signal map (`signals.json`)

```json
{
  "0x0C0": { "name": "vehicle_speed", "unit": "mph", "scale": 0.01, "offset": 0 },
  "0x190": { "name": "direction",     "unit": "enum", "values": { "0": "N", "1": "F", "2": "R" } },
  "0x205": { "name": "fork_height",   "unit": "inches", "scale": 0.1, "offset": 0 },
  "0x210": { "name": "hyd_pressure",  "unit": "PSI",  "scale": 1.0, "offset": 0 },
  "0x215": { "name": "tilt_angle",    "unit": "deg",  "scale": 0.1, "offset": -10 },
  "0x300": { "name": "seat_switch",   "unit": "bool", "values": { "0": "VACANT", "1": "SEATED" } },
  "0x620": { "name": "battery_soc",   "unit": "%",    "scale": 0.5, "offset": 0 },
  "0x621": { "name": "battery_volt",  "unit": "V",    "scale": 0.1, "offset": 0 },
  "0x625": { "name": "battery_temp",  "unit": "F",    "scale": 0.1, "offset": -40 },
  "0x1D4": { "name": "motor_current", "unit": "A",    "scale": 0.1, "offset": -1000 },
  "0x1E0": { "name": "motor_temp",    "unit": "F",    "scale": 0.5, "offset": 0 },
  "0x700": { "name": "hour_meter",    "unit": "h",    "scale": 0.1, "offset": 0 }
}
```

> **Note:** These CAN IDs and signal encodings are representative placeholders. You will need to confirm the actual IDs and byte layouts by logging raw CAN traffic from your specific forklift model and cross-referencing with any available service documentation.

### WebSocket server (`bridge.py`)

```python
import asyncio, json, can, websockets

SIGNALS = json.load(open('signals.json'))

async def handler(websocket):
    bus = can.interface.Bus(channel='can0', bustype='socketcan')
    for msg in bus:
        arb = hex(msg.arbitration_id)
        if arb in SIGNALS:
            sig = SIGNALS[arb]
            raw = int.from_bytes(msg.data[:2], 'big')
            value = raw * sig['scale'] + sig['offset']
            await websocket.send(json.dumps({
                'id': arb,
                'name': sig['name'],
                'value': round(value, 2),
                'unit': sig['unit']
            }))

async def main():
    async with websockets.serve(handler, 'localhost', 8765):
        await asyncio.Future()

asyncio.run(main())
```

### Browser WebSocket client (`can-client.js`)

```js
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = (event) => {
  const { name, value } = JSON.parse(event.data);
  window.dispatchEvent(new CustomEvent('can-data', { detail: { name, value } }));
};

// Each module listens:
window.addEventListener('can-data', ({ detail }) => {
  if (detail.name === 'vehicle_speed') updateSpeedGauge(detail.value);
  if (detail.name === 'fork_height')   updateForkHeight(detail.value);
  // etc.
});
```

---

## Startup — Raspberry Pi

### `/etc/rc.local` or systemd service

```bash
# Start CAN interface
sudo ip link set can0 up type can bitrate 250000

# Start WebSocket bridge
python3 /home/pi/forklift-dash/can-bridge/bridge.py &

# Start Chromium in kiosk mode
chromium-browser --kiosk --app=http://localhost:3000 \
  --disable-infobars --noerrdialogs \
  --disable-session-crashed-bubble &
```

### Simple HTTP server

```bash
cd /home/pi/forklift-dash
python3 -m http.server 3000
```

Or use `serve` via npm: `npx serve . -p 3000`

---

## Development Mode (without live CAN)

The bridge should support a `--simulate` flag that generates synthetic signal data on a timer, allowing the UI to be developed and tested without a physical forklift connected.

```bash
python3 bridge.py --simulate
```

Simulated signals should include realistic movement patterns: speed ramping up and down, fork height cycling, battery draining slowly, etc.

---

## 3D Model Credit

Per CC Attribution license:

> 3D model: "Forklift" by Arsen Ismailov, licensed under CC BY 4.0.
> Source: sketchfab.com/3d-models/forklift-bdb03db7036e436286f4e2fd34c02a89

This credit must appear somewhere in the application (settings screen or about page is fine).

---

## Visual Design Reference

| Property | Value |
|---|---|
| Background | `#080808` |
| Panel background | `#0b0b0b` |
| Panel border | `0.5px solid #161616` |
| Safety bar (clear) | `#040e06` |
| Safety bar (warn) | `#0e0a00` |
| Safety bar (alarm) | `#0e0404` |
| Accent blue | `#4fc3f7` |
| Accent green | `#4caf50` |
| Accent amber | `#ffb300` |
| Accent red | `#f44336` |
| Linde body red | `#C82418` |
| Font | Helvetica Neue, Helvetica, sans-serif |
| Base font size | 12–14px for data labels |
| Label style | 9px, letter-spacing: 1.2px, color: #484848 |

---

*Generated with Claude — concept designed across multiple sessions before coding began.*
