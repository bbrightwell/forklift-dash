# Project Context

## What This Is
Full-screen CAN bus dashboard for the Linde E20 (1252/1254 series) electric counterbalance forklift. Reads live vehicle telemetry from the CAN bus and displays it via a Tesla-inspired dark UI running in Chromium on a Raspberry Pi. Supports live CAN, log replay with animated motion overlays, and fully synthetic simulation.

## Ecosystem Context
This project is part of a personal CAN bus tooling ecosystem. Key principles:
- Each tool is self-contained but shares common resources via the canbus-definitions submodule (.dbc files, VDI specs)
- Tools are built slowly and deliberately — existing functionality is stabilized before new features are added
- The long-term goal is a suite of complementary tools for CAN bus analysis, injection, capture, debugging, and AI inference
- Avoid rushing feature sets — don't break working functionality chasing new capabilities

## Current State
**~80% feature-complete.** Core dashboard polished; decoder rewritten to use cantools DBC; new energy and work-time signals live.

Working:
- Live CAN bus integration (socketcan on can0) with 20Hz batched broadcasting
- WebSocket bridge (Python backend on port 8765 → browser frontend on port 8080)
- Three-panel layout: left controls, center reserved, right telemetry
- Safety bar with state machine (deadman switch, mast tilt, hydraulic pressure, load sensor)
- Speed gauge (canvas arc), direction indicator, traction mode pills
- Pedal bars (throttle/brake visualization)
- Tesla-style rolling power consumption graph (30s history, draw/regen coloring)
- Energy consumption graph (kWh/h rolling 60s history, amber fill)
- Battery display (SoC, voltage, temp, health status)
- Hydraulic torque gauge (replaced pressure — now using L1_estTorque from DBC)
- Tilt angle SVG animation
- Fork height progress bar with status badges
- Operating hours, truck hours (from display controller), and remaining work time
- DBC-based decoder (cantools) replacing manual signals.json — all signal decoding now via Linde DBC files
- SIM toggle replays real CAN traces via DBC decoder with animated motion overlay
- Simulator generates energy_consumption, remaining_work_time, truck_hours signals
- Standalone concept file (forklift_dash_concept_v2.html) — fully self-contained, no server

Not working / incomplete:
- Center panel vehicle graphic — intentionally reserved, Three.js removed for performance
- Horn, lights, lift speed buttons — UI present but wired to stub functions (no CAN output)
- Operator authentication and settings overlay
- Load sensor hardcoded as "NOT FITTED"

## Next Steps
- **PRIORITY:** Remove hardcoded cross-repo log path (../canbus-analysis-application/logs/session_4.log) — replace with configurable path or relative reference so replay mode doesn't break silently when session files move
- Verify DBC-decoded signals against live CAN capture on the truck
- Implement bidirectional control (horn, lights, lift speed via CAN commands)
- Add center panel vehicle graphic (photo-based or simple vector)
- Error UI for missing files / connection failures (currently console-only)
- Operator authentication and settings overlay

## Key Decisions
- **Vanilla JS, no build step** — ES6 modules served directly, Pi-friendly, fast iteration
- **WebSocket + JSON bridge** — all CAN data serialized as JSON, decouples hardware from UI
- **Three bridge modes** — live CAN (20Hz batched), log replay (DBC-decoded baseline + simulated motion), synthetic simulation
- **DBC-based decoding via cantools** — replaced manual signals.json with Linde DBC files (CAN0_346_02.dbc, battery_cb_24_10_2022.dbc), metric→imperial conversions, sentinel filtering
- **Log replay with animated baseline** — real electrical data (battery, motor temp, voltage) from first 500 frames of log, with overlaid motion patterns for dynamic signals
- **Canvas gauges + SVG animation** — lightweight, no GPU required, fast on Pi
- **Safety bar state machine** — four independent zones, worst state wins, alarm pulse on any fault
- **Three.js removed** — heavyweight 3D model replaced with reserved panel; photo-based viewer available separately
- **Linde branding** — #A00020 red theme, professional dark UI
- **Cross-repo dependencies should be avoided** — each tool should be self-contained with configurable references to external files

## Known Issues
- DBC-decoded signal values need verification against live CAN capture on the actual truck
- No bidirectional control — dashboard is read-only, control buttons are stubs
- Hardcoded log path (../canbus-analysis-application/logs/session_4.log) — skipped silently if missing
- scene.js and forklift-model.js are stubs left from Three.js removal — imports remain in main.js
- WebSocket unencrypted on localhost only — not suitable for remote access without TLS
- No graceful HTTP server shutdown — sockets may linger in TIME_WAIT

## Last Updated
2026-03-30 — Decoder rewritten to use cantools DBC (replaced signals.json); live CAN 20Hz batching; energy consumption graph; hydraulic pressure→torque; remaining work time and truck hours signals; log_replayer simplified; UI refinements
