#!/usr/bin/env bash
# Launch the Forklift Dashboard: bridge + Chromium kiosk
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any previous instances
kill $(lsof -t -i :8080) 2>/dev/null || true
kill $(lsof -t -i :8765) 2>/dev/null || true
sleep 0.3

# Start the CAN-to-WebSocket bridge
# If can0 is present it reads live; otherwise idles waiting for SIM toggle
python3 "$DIR/can-bridge/bridge.py" &
BRIDGE_PID=$!

# Start a local HTTP server for the dashboard
python3 -m http.server 8080 --directory "$DIR" &
HTTP_PID=$!

# Wait briefly for servers to be ready
sleep 1

# Launch Chromium in a normal window
chromium --disable-session-crashed-bubble --disable-translate \
    --no-first-run \
    "http://localhost:8080" &
CHROME_PID=$!

# When Chromium closes, stop the bridge
cleanup() {
    kill $BRIDGE_PID 2>/dev/null || true
    kill $HTTP_PID 2>/dev/null || true
    wait $BRIDGE_PID 2>/dev/null || true
    wait $HTTP_PID 2>/dev/null || true
}
trap cleanup EXIT

wait $CHROME_PID
