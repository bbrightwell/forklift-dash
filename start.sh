#!/usr/bin/env bash
# Launch the Forklift Dashboard: bridge + Chromium kiosk
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Start the CAN-to-WebSocket bridge (simulated data if no can0)
if ip link show can0 &>/dev/null; then
    python3 "$DIR/can-bridge/bridge.py" &
else
    python3 "$DIR/can-bridge/bridge.py" --simulate &
fi
BRIDGE_PID=$!

# Start a local HTTP server for the dashboard
python3 -m http.server 8080 --directory "$DIR" &
HTTP_PID=$!

# Wait briefly for servers to be ready
sleep 1

# Launch Chromium in kiosk mode
chromium --kiosk --disable-infobars --noerrdialogs \
    --disable-session-crashed-bubble --disable-translate \
    --no-first-run --start-fullscreen \
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
