#!/usr/bin/env bash
# Launch the Forklift Dashboard: bridge + Chromium kiosk
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Bring up CAN interfaces (safe to re-run if already up)
for iface in can0 can1; do
    if ip link show "$iface" &>/dev/null; then
        sudo ip link set "$iface" down 2>/dev/null || true
        sudo ip link set "$iface" up type can bitrate 500000
        echo "$iface UP at 500 kbps"
    fi
done

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

# When script exits, stop the bridge and HTTP server
cleanup() {
    kill $BRIDGE_PID 2>/dev/null || true
    kill $HTTP_PID 2>/dev/null || true
    wait $BRIDGE_PID 2>/dev/null || true
    wait $HTTP_PID 2>/dev/null || true
}
trap cleanup EXIT

# Launch Chromium in a new window
chromium --disable-session-crashed-bubble --disable-translate \
    --no-first-run --new-window \
    "http://localhost:8080" &
CHROME_PID=$!

# If chromium exits quickly, it handed off to an existing instance.
# In that case, keep servers alive until this script is killed.
sleep 2
if ! kill -0 $CHROME_PID 2>/dev/null; then
    # Chromium delegated to existing instance — wait on servers instead
    wait $BRIDGE_PID $HTTP_PID
else
    wait $CHROME_PID
fi
