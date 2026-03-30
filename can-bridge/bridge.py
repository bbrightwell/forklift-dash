#!/usr/bin/env python3
"""CAN-to-WebSocket bridge for Forklift Dashboard.

Reads CAN messages from socketcan (can0), replays a recorded log,
or generates synthetic data — then broadcasts decoded signals as JSON
over WebSocket.

The dashboard can send JSON commands to toggle simulation:
    {"cmd": "start_sim"}   — start replaying the CAN trace log
    {"cmd": "stop_sim"}    — stop replay, return to idle/live

Usage:
    python3 bridge.py               # Live CAN bus on can0 (falls back to idle)
    python3 bridge.py --simulate    # Start with synthetic data immediately
"""

import argparse
import asyncio
import json
import math
import time

import websockets

from decoder import decode_frame

WS_PORT = 8765
CLIENTS = set()

# Replay state
_replay_task = None
_sim_active = False


# --------------- WebSocket server ---------------

async def handler(websocket):
    CLIENTS.add(websocket)
    # Send current sim state on connect
    await websocket.send(json.dumps({"sim_status": _sim_active}))
    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            cmd = msg.get("cmd")
            if cmd == "start_sim":
                await start_replay()
            elif cmd == "stop_sim":
                await stop_replay()
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


# --------------- Log Replay ---------------

async def replay_loop():
    """Replay the CAN trace log in real time, looping when finished."""
    global _sim_active
    from log_replayer import LogReplayer

    try:
        replayer = LogReplayer()
    except Exception as e:
        print(f"Failed to load log replayer: {e}")
        _sim_active = False
        await broadcast({"sim_status": False, "sim_error": str(e)})
        return

    print(f"Replay started: {replayer.total_frames} frames, {replayer.duration:.1f}s duration")
    await broadcast({"sim_status": True})

    t0 = time.monotonic()

    while _sim_active:
        elapsed = time.monotonic() - t0
        batch = replayer.get_next_batch(elapsed)

        for signals in batch:
            for key, value in signals.items():
                await broadcast({key: value})

        await asyncio.sleep(0.05)  # 20 Hz update rate

    print("Replay stopped")


async def start_replay():
    global _replay_task, _sim_active
    if _sim_active:
        return
    _sim_active = True
    _replay_task = asyncio.create_task(replay_loop())
    print("Simulation ON — replaying CAN trace log")


async def stop_replay():
    global _replay_task, _sim_active
    if not _sim_active:
        return
    _sim_active = False
    # Give the loop a moment to exit
    if _replay_task:
        try:
            await asyncio.wait_for(_replay_task, timeout=2.0)
        except asyncio.TimeoutError:
            _replay_task.cancel()
        _replay_task = None
    await broadcast({"sim_status": False})
    print("Simulation OFF")


# --------------- Live CAN reader ---------------

async def can_reader():
    """Read from socketcan interface and broadcast decoded signals at 20Hz."""
    import can  # imported here so replay works without python-can hardware

    bus = can.interface.Bus(channel="can0", interface="socketcan")
    loop = asyncio.get_event_loop()

    # Accumulate latest values from all frames, broadcast at fixed rate
    pending = {}
    pending_lock = asyncio.Lock()

    async def reader_loop():
        while True:
            msg = await loop.run_in_executor(None, bus.recv, 1.0)
            if msg is None:
                continue
            decoded = decode_frame(msg.arbitration_id, msg.data)
            if decoded:
                async with pending_lock:
                    pending.update(decoded)

    async def broadcast_loop():
        while True:
            await asyncio.sleep(0.05)  # 20 Hz
            async with pending_lock:
                if pending:
                    snapshot = dict(pending)
                    pending.clear()
                else:
                    continue
            await broadcast(snapshot)

    await asyncio.gather(reader_loop(), broadcast_loop())


# --------------- Simulator (synthetic) ---------------

async def simulator():
    """Generate synthetic forklift data for desk development."""
    global _sim_active
    _sim_active = True
    await broadcast({"sim_status": True})

    t0 = time.time()
    battery_soc = 72.0
    motor_temp = 142.0
    hour_meter = 4218.3

    while _sim_active:
        t = time.time() - t0

        cycle = t % 30
        if cycle < 10:
            speed = (cycle / 10) * 5
        elif cycle < 20:
            speed = 5.0
        else:
            speed = 5.0 - ((cycle - 20) / 10) * 5
        speed = max(0, speed)

        direction = 1 if speed > 0.1 else 0
        fork_height = max(0, 24 + 24 * math.sin(t * 2 * math.pi / 60))
        fork_vel = abs(math.cos(t * 2 * math.pi / 60))
        hyd_torque = 3 + fork_vel * 15
        tilt_angle = 2.0 * math.sin(t * 2 * math.pi / 45)
        battery_soc = max(0, battery_soc - 0.001)
        battery_voltage = 44.0 + (battery_soc / 100) * 8
        battery_temp = 90 + 5 * math.sin(t * 2 * math.pi / 120)
        motor_current = speed * 60
        motor_temp = min(220, motor_temp + 0.002)
        hour_meter += 0.1 / 50
        seat_switch = 0 if int(t) % 60 >= 58 else 1
        energy_consumption = speed * 0.8 + fork_vel * 1.5
        remaining_work_time = max(0, int(240 - t * 0.2))

        await broadcast({"vehicle_speed": round(speed, 2)})
        await broadcast({"direction": int(direction)})
        await broadcast({"fork_height": round(fork_height, 1)})
        await broadcast({"hyd_torque": round(hyd_torque, 1)})
        await broadcast({"tilt_angle": round(tilt_angle, 1)})
        await broadcast({"seat_switch": seat_switch})
        await broadcast({"battery_soc": round(battery_soc, 1)})
        await broadcast({"battery_voltage": round(battery_voltage, 1)})
        await broadcast({"battery_temp": round(battery_temp, 1)})
        await broadcast({"motor_current": round(motor_current, 1)})
        await broadcast({"motor_temp": round(motor_temp, 1)})
        await broadcast({"hour_meter": round(hour_meter, 1)})
        await broadcast({"energy_consumption": round(energy_consumption, 2)})
        await broadcast({"remaining_work_time": remaining_work_time})
        await broadcast({"truck_hours": round(hour_meter + 71.0, 1)})

        await asyncio.sleep(0.1)


# --------------- Main ---------------

async def main(simulate=False):
    async with websockets.serve(handler, "0.0.0.0", WS_PORT):
        print(f"WebSocket server running on ws://0.0.0.0:{WS_PORT}")
        if simulate:
            print("Simulation mode — generating synthetic forklift data")
            await simulator()
        else:
            # Try live CAN, fall back to idle (waiting for UI sim toggle)
            try:
                import can
                can.interface.Bus(channel="can0", interface="socketcan")
                print("Live mode — reading from can0")
                await can_reader()
            except Exception:
                print("No CAN hardware — idle mode, waiting for SIM toggle from dashboard")
                while True:
                    await asyncio.sleep(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Forklift CAN-to-WebSocket bridge")
    parser.add_argument("--simulate", action="store_true", help="Generate synthetic data")
    args = parser.parse_args()

    asyncio.run(main(simulate=args.simulate))
