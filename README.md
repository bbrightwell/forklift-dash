# Forklift Dashboard

Full-screen CAN bus dashboard for electric forklifts. Runs in Chromium kiosk mode on Raspberry Pi at 1920x1080. Tesla-style dark UI with real-time 3D vehicle visualization and live CAN data.

## Quick Start (Development)

No npm or build step required. All JS loaded via CDN.

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
# From the forklift-dash directory
python3 -m http.server 3000
```

### 4. Open in browser

```
http://localhost:3000
```

## Live CAN Bus Setup

### Set up the CAN interface

```bash
sudo ip link set can0 up type can bitrate 250000
```

### Verify CAN is receiving

```bash
candump can0
```

### Run the bridge in live mode

```bash
cd can-bridge
python3 bridge.py
```

## Chromium Kiosk Mode

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-translate --no-first-run --fast --fast-start \
  --disable-features=TranslateUI --disk-cache-dir=/tmp/chromium-cache \
  http://localhost:3000
```

## Auto-Start with systemd

### CAN bridge service

Create `/etc/systemd/system/forklift-can.service`:

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

### Web server service

Create `/etc/systemd/system/forklift-web.service`:

```ini
[Unit]
Description=Forklift Dashboard Web Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/forklift-dash
ExecStart=/usr/bin/python3 -m http.server 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Kiosk browser service

Create `/etc/systemd/system/forklift-kiosk.service`:

```ini
[Unit]
Description=Forklift Dashboard Kiosk
After=forklift-web.service forklift-can.service graphical.target
Wants=forklift-web.service forklift-can.service

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 5
ExecStart=/usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-translate --no-first-run --fast --fast-start --disable-features=TranslateUI --disk-cache-dir=/tmp/chromium-cache http://localhost:3000
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

### Enable services

```bash
sudo systemctl daemon-reload
sudo systemctl enable forklift-can forklift-web forklift-kiosk
sudo systemctl start forklift-can forklift-web forklift-kiosk
```

## CAN Signal Map

| Arb ID | Signal          | Unit    | Scale | Offset |
|--------|-----------------|---------|-------|--------|
| 0x0C0  | vehicle_speed   | mph     | 0.01  | 0      |
| 0x190  | direction       | enum    | 1     | 0      |
| 0x205  | fork_height     | inches  | 0.1   | 0      |
| 0x210  | hyd_pressure    | PSI     | 1.0   | 0      |
| 0x215  | tilt_angle      | degrees | 0.1   | -10    |
| 0x300  | seat_switch     | bool    | 1     | 0      |
| 0x620  | battery_soc     | %       | 0.5   | 0      |
| 0x621  | battery_voltage | V       | 0.1   | 0      |
| 0x625  | battery_temp    | °F      | 0.1   | -40    |
| 0x1D4  | motor_current   | A       | 0.1   | -1000  |
| 0x1E0  | motor_temp      | °F      | 0.5   | 0      |
| 0x700  | hour_meter      | h       | 0.1   | 0      |

## 3D Model

Forklift model: [Arsen Ismailov on Sketchfab](https://sketchfab.com/) — CC BY 4.0

Place `forklift.glb` in the project root. The dashboard will log all mesh names to the console on load so you can identify and configure the fork carriage group.

## Architecture

```
Browser (1920x1080)          Python bridge
┌───────────────────┐       ┌──────────────┐
│  index.html       │◄──ws──┤  bridge.py   │◄── can0 (socketcan)
│  Three.js scene   │       │  decoder.py  │    or --simulate
│  2D callout overlay│       │  signals.json│
│  CAN data binding │       └──────────────┘
└───────────────────┘
```
