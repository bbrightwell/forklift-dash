#!/usr/bin/env python3
"""CAN-to-WebSocket bridge for Forklift Dashboard.

Reads CAN messages from socketcan (can0) or simulates them,
then broadcasts decoded signals as JSON over WebSocket.

Usage:
    python3 bridge.py               # Live CAN bus on can0
    python3 bridge.py --simulate    # Synthetic data for development
"""

import argparse
import asyncio
import json
import math
import time

import websockets

from decoder import load_signals, decode_message

SIGNALS = load_signals()
WS_PORT = 8765
CLIENTS = set()


# --------------- WebSocket server ---------------

async def handler(websocket):
    CLIENTS.add(websocket)
    try:
        async for _ in websocket:
            pass  # We only send; ignore incoming
    finally:
        CLIENTS.discard(websocket)


async def broadcast(data: dict):
    if not CLIENTS:
        return
    msg = json.dumps(data)
    await asyncio.gather(
        *(ws.send(msg) for ws in CLIENTS),
        return_exceptions=True,
    )


# --------------- Live CAN reader ---------------

async def can_reader():
    """Read from socketcan interface and broadcast decoded signals."""
    import can  # imported here so --simulate works without python-can

    bus = can.interface.Bus(channel="can0", interface="socketcan")
    loop = asyncio.get_event_loop()

    while True:
        msg = await loop.run_in_executor(None, bus.recv, 1.0)
        if msg is None:
            continue
        decoded = decode_message(msg.arbitration_id, msg.data, SIGNALS)
        if decoded:
            await broadcast(decoded)


# --------------- Simulator ---------------

async def simulator():
    """Generate synthetic forklift data for desk development."""
    t0 = time.time()
    battery_soc = 72.0
    motor_temp = 142.0
    hour_meter = 4218.3
    last_seat_event = 0

    while True:
        t = time.time() - t0

        # Speed: ramp up to 5, hold, ramp back — 30s cycle
        cycle = t % 30
        if cycle < 10:
            speed = (cycle / 10) * 5
        elif cycle < 20:
            speed = 5.0
        else:
            speed = 5.0 - ((cycle - 20) / 10) * 5
        speed = max(0, speed)

        # Direction: F when moving forward, N when stopped
        direction = 1 if speed > 0.1 else 0

        # Fork height: slow sine, 0–48 inches over 60s
        fork_height = 24 + 24 * math.sin(t * 2 * math.pi / 60)
        fork_height = max(0, fork_height)

        # Hydraulic pressure: rises with fork movement
        fork_vel = abs(math.cos(t * 2 * math.pi / 60))
        hyd_pressure = 600 + fork_vel * 800

        # Tilt angle: gentle oscillation
        tilt_angle = 2.0 * math.sin(t * 2 * math.pi / 45)

        # Battery drains slowly
        battery_soc = max(0, battery_soc - 0.001)
        battery_voltage = 44.0 + (battery_soc / 100) * 8  # 44–52V range

        # Battery temp creeps up
        battery_temp = 90 + 5 * math.sin(t * 2 * math.pi / 120)

        # Motor current: proportional to speed
        motor_current = speed * 60  # 0–300A

        # Motor temp warms slowly
        motor_temp = min(220, motor_temp + 0.002)

        # Hour meter ticks
        hour_meter += 0.1 / 50  # ~1 tick per 500 cycles ≈ realistic

        # Seat switch: vacant for 2s every 60s
        seat_switch = 1
        if int(t) % 60 >= 58:
            seat_switch = 0

        # Broadcast all signals
        await broadcast({"vehicle_speed": round(speed, 2)})
        await broadcast({"direction": int(direction)})
        await broadcast({"fork_height": round(fork_height, 1)})
        await broadcast({"hyd_pressure": round(hyd_pressure, 0)})
        await broadcast({"tilt_angle": round(tilt_angle, 1)})
        await broadcast({"seat_switch": seat_switch})
        await broadcast({"battery_soc": round(battery_soc, 1)})
        await broadcast({"battery_voltage": round(battery_voltage, 1)})
        await broadcast({"battery_temp": round(battery_temp, 1)})
        await broadcast({"motor_current": round(motor_current, 1)})
        await broadcast({"motor_temp": round(motor_temp, 1)})
        await broadcast({"hour_meter": round(hour_meter, 1)})

        await asyncio.sleep(0.1)  # 10 Hz update rate


# --------------- Main ---------------

async def main(simulate=False):
    async with websockets.serve(handler, "0.0.0.0", WS_PORT):
        print(f"WebSocket server running on ws://0.0.0.0:{WS_PORT}")
        if simulate:
            print("Simulation mode — generating synthetic forklift data")
            await simulator()
        else:
            print("Live mode — reading from can0")
            await can_reader()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Forklift CAN-to-WebSocket bridge")
    parser.add_argument("--simulate", action="store_true", help="Generate synthetic data")
    args = parser.parse_args()

    asyncio.run(main(simulate=args.simulate))
