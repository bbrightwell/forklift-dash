"""Replay a canbus-analyzer session log, decoding frames via DBC into dashboard signals.

The session_4.log was captured from a stationary truck so most dynamic signals
(speed, fork height, tilt) contain sentinel values.  Two replay modes:

  mode="raw"     — play the actual decoded data (mostly idle-state values)
  mode="animated" — use real electrical baseline (battery, voltage, temps, hours)
                    but overlay realistic simulated motion for speed/fork/tilt
"""

import math
import os
import re
import time

import cantools

from decoder import _map_to_dashboard, RELEVANT_IDS, _DBC_DIR, _DBC_FILES

# Paths
LOG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "canbus-analysis-application", "logs", "session_4.log"
)
DBC_DIR = _DBC_DIR
DBC_FILES = _DBC_FILES

LINE_RE = re.compile(
    r"\[([\d:.]+)\]\s+(\w+)\s+(0x[\dA-Fa-f]+)\s+\S+\s+\S+\s+((?:[0-9A-Fa-f]{2}\s*)+)"
)


def _load_dbc():
    db_lookup = {}
    for fname in DBC_FILES:
        path = os.path.join(DBC_DIR, fname)
        if not os.path.exists(path):
            continue
        db = cantools.database.load_file(path)
        for msg in db.messages:
            if msg.frame_id in RELEVANT_IDS:
                db_lookup[msg.frame_id] = msg
    return db_lookup


def parse_log(path=LOG_PATH):
    frames = []
    t0 = None

    with open(path, "r") as f:
        for line in f:
            m = LINE_RE.match(line)
            if not m:
                continue
            ts_str, bus, can_id_str, data_str = m.groups()
            if bus != "can0":
                continue
            can_id = int(can_id_str, 16)
            if can_id not in RELEVANT_IDS:
                continue

            parts = ts_str.split(":")
            h, mn = int(parts[0]), int(parts[1])
            s = float(parts[2])
            ts = h * 3600 + mn * 60 + s
            if t0 is None:
                t0 = ts

            data = bytes.fromhex(data_str.replace(" ", "").strip())
            frames.append((ts - t0, can_id, data))

    return frames


class LogReplayer:
    """Replays parsed log frames, yielding dashboard signal dicts."""

    def __init__(self, path=LOG_PATH, mode="animated"):
        """
        mode="raw"      — play exactly what's in the log
        mode="animated"  — real electrical data + simulated motion overlay
        """
        self._db = _load_dbc()
        self._frames = parse_log(path)
        self._mode = mode
        self._index = 0

        # Extract real baseline from first pass
        self._baseline = {}
        self._extract_baseline()

        print(f"LogReplayer: loaded {len(self._frames)} frames, mode={mode}")
        print(f"LogReplayer: baseline: {self._baseline}")

    def _extract_baseline(self):
        """Decode all frames once to get stable baseline values."""
        for ts, can_id, data in self._frames[:500]:
            msg_def = self._db.get(can_id)
            if msg_def is None:
                continue
            expected_len = msg_def.length
            if len(data) < expected_len:
                data = data + b"\x00" * (expected_len - len(data))
            try:
                decoded = msg_def.decode(data[:expected_len], decode_choices=False)
            except Exception:
                continue
            signals = _map_to_dashboard(decoded)
            for k, v in signals.items():
                if k not in self._baseline:
                    self._baseline[k] = v

    @property
    def total_frames(self):
        return len(self._frames)

    @property
    def duration(self):
        if not self._frames:
            return 0
        # In animated mode, loop every 60s for variety
        if self._mode == "animated":
            return 60.0
        return self._frames[-1][0]

    def reset(self):
        self._index = 0

    def get_animated_signals(self, elapsed: float) -> dict:
        """Generate dashboard signals with real baseline + simulated dynamics."""
        t = elapsed
        out = dict(self._baseline)

        # Speed: ramp up, cruise, ramp down — 30s cycle
        cycle = t % 30
        if cycle < 8:
            speed = (cycle / 8) * 6
        elif cycle < 18:
            speed = 6.0 + 1.5 * math.sin(t * 0.8)  # cruising with slight variation
        else:
            speed = max(0, 6.0 - ((cycle - 18) / 12) * 6)
        out["vehicle_speed"] = round(max(0, speed), 2)

        # Direction: F when moving, N when stopped
        out["direction"] = 1 if speed > 0.2 else 0

        # Fork height: slow lift/lower — 45s cycle
        fork_cycle = t % 45
        if fork_cycle < 15:
            fork = (fork_cycle / 15) * 36  # raise to 36 inches
        elif fork_cycle < 30:
            fork = 36.0  # hold
        else:
            fork = 36.0 - ((fork_cycle - 30) / 15) * 36  # lower
        out["fork_height"] = round(max(0, fork), 1)

        # Hydraulic torque: rises when forks moving
        if fork_cycle < 15 or fork_cycle > 30:
            out["hyd_torque"] = round(12 + 8 * abs(math.sin(t * 0.5)), 1)
        else:
            out["hyd_torque"] = round(3 + 2 * math.sin(t * 0.3), 1)

        # Tilt angle: gentle oscillation
        out["tilt_angle"] = round(2.0 * math.sin(t * 2 * math.pi / 40), 1)

        # Seat switch: always seated in animated mode
        out["seat_switch"] = 1

        # Throttle & brake: derived from speed cycle
        if cycle < 8:
            # Accelerating — throttle proportional to acceleration
            out["throttle"] = round((cycle / 8) * 75 + 10, 0)
            out["brake"] = 0
        elif cycle < 18:
            # Cruising — moderate throttle, no brake
            out["throttle"] = round(30 + 15 * abs(math.sin(t * 0.8)), 0)
            out["brake"] = 0
        elif cycle < 20:
            # Coasting — lifting off throttle
            out["throttle"] = round(max(0, 20 - (cycle - 18) * 10), 0)
            out["brake"] = 0
        else:
            # Braking to stop
            out["throttle"] = 0
            brk_phase = (cycle - 20) / 10
            out["brake"] = 1 if brk_phase < 0.8 else 0

        # Motor current: proportional to speed + fork lift
        base_current = speed * 45
        if fork_cycle < 15:
            base_current += 80  # extra draw when lifting
        # Regen when braking
        if out.get("brake") and speed > 0.5:
            base_current = -(speed * 30)
        out["motor_current"] = round(base_current, 1)

        # Motor temp: creep up slowly from baseline
        base_temp = self._baseline.get("motor_temp", 70)
        out["motor_temp"] = round(base_temp + min(t * 0.1, 20) + 3 * math.sin(t * 0.05), 1)

        # Battery slowly drains from real SOC baseline
        base_soc = self._baseline.get("battery_soc", 52)
        out["battery_soc"] = round(max(0, base_soc - t * 0.01), 1)

        # Battery voltage tracks SOC
        base_volt = self._baseline.get("battery_voltage", 52.5)
        out["battery_voltage"] = round(base_volt - t * 0.002, 1)

        # Battery temp: slow warming
        out["battery_temp"] = round(85 + 5 * math.sin(t * 0.04), 1)

        # Hour meter from baseline
        base_hours = self._baseline.get("hour_meter", 43.0)
        out["hour_meter"] = round(base_hours + t / 3600, 1)

        # Truck hours (offset from work hours to show they differ)
        out["truck_hours"] = round(base_hours + 71.0 + t / 3600, 1)

        # Energy consumption: proportional to speed + fork activity
        fork_vel = abs(math.cos(t * 2 * math.pi / 45))
        out["energy_consumption"] = round(speed * 0.6 + fork_vel * 1.2, 2)

        # Remaining work time: drains from ~4 hours
        out["remaining_work_time"] = max(0, int(240 - t * 0.15))

        return out

    def get_next_batch(self, elapsed: float) -> list[dict]:
        """Return signal updates up to `elapsed` seconds."""
        if self._mode == "animated":
            return [self.get_animated_signals(elapsed)]

        # Raw mode: replay actual frames
        results = []
        while self._index < len(self._frames):
            ts, can_id, data = self._frames[self._index]
            if ts > elapsed:
                break
            self._index += 1

            msg_def = self._db.get(can_id)
            if msg_def is None:
                continue
            expected_len = msg_def.length
            if len(data) < expected_len:
                data = data + b"\x00" * (expected_len - len(data))
            try:
                decoded = msg_def.decode(data[:expected_len], decode_choices=False)
            except Exception:
                continue

            signals = _map_to_dashboard(decoded)
            if signals:
                results.append(signals)

        return results

    @property
    def finished(self):
        if self._mode == "animated":
            return False  # animated loops forever
        return self._index >= len(self._frames)
