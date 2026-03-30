"""CAN signal decoder — decodes raw CAN frames via DBC definitions using cantools.

Loads Linde DBC files and maps decoded signals to dashboard-friendly names
with unit conversions (metric → imperial where needed) and sentinel filtering.
"""

import os

import cantools

# DBC files relative to this script → ../canbus-definitions/
_DBC_DIR = os.path.join(os.path.dirname(__file__), "..", "canbus-definitions")
_DBC_FILES = ["CAN0_346_02.dbc", "battery_cb_24_10_2022.dbc"]

# CAN IDs we care about for the dashboard
RELEVANT_IDS = {
    0x181,  # Traction_PDO1_38x  → TruckSpeed, TSteerAngle
    0x182,  # Lift_PDO1_can0     → L1_measSpeed, L1_estTorque (hydraulic motor)
    0x21E,  # Traction_PDO9      → kec_accelerator_pedal_position
    0x281,  # Traction_PDO2      → T_Seat, T_motTemp_Lft, T_BatVolt, T_BatCurr, BrakeState
    0x282,  # Lift_PDO2_can0     → LiftHeight, LiftTiltAng
    0x304,  # Traction_PDO5      → TracDirLev, RemWorkTime
    0x413,  # Traction_PDO8      → EConsum, performance_mode
    0x481,  # Traction_PDO4      → TruckWorkTime
    0x484,  # Display_PDO4       → WorkTimeToBeDisplayed
    0x48D,  # LiIoBMS_PDO4       → LiIoBMS_SOCwithSOH
    0x513,  # Lift_PDO6          → battery_temperature, WghdLoad
}

# Built at module load
_db_lookup: dict[int, cantools.database.Message] = {}


def _load_dbc():
    """Load DBC files and build a {frame_id: Message} lookup for relevant IDs."""
    for fname in _DBC_FILES:
        path = os.path.join(_DBC_DIR, fname)
        if not os.path.exists(path):
            print(f"[decoder] WARNING: DBC file not found: {path}")
            continue
        db = cantools.database.load_file(path)
        for msg in db.messages:
            if msg.frame_id in RELEVANT_IDS:
                _db_lookup[msg.frame_id] = msg
    print(f"[decoder] Loaded {len(_db_lookup)} DBC message definitions")
    for fid, msg in sorted(_db_lookup.items()):
        print(f"[decoder]   0x{fid:03X} → {msg.name}")


def _map_to_dashboard(decoded: dict) -> dict:
    """Map DBC signal names to dashboard signal names with unit conversions."""
    out = {}

    # --- Speed: km/h → mph ---
    if "TruckSpeed" in decoded:
        v = abs(decoded["TruckSpeed"]) * 0.621371
        if v < 50:
            out["vehicle_speed"] = round(v, 2)

    # --- Direction: 0=N, 1=F, 2=R ---
    if "TracDirLev" in decoded:
        val = int(decoded["TracDirLev"])
        if val <= 2:
            out["direction"] = val

    # --- Fork height: mm → inches ---
    if "LiftHeight" in decoded:
        mm = decoded["LiftHeight"]
        if 0 <= mm <= 10000:
            out["fork_height"] = round(mm / 25.4, 1)
        else:
            out["fork_height"] = 0.0

    # --- Tilt angle: degrees (DBC already in deg) ---
    # Raw 0x7F (127) → 12.7° is the sentinel for "not available"
    if "LiftTiltAng" in decoded:
        deg = decoded["LiftTiltAng"]
        if -25 <= deg <= 25 and abs(deg - 12.7) > 0.01:
            out["tilt_angle"] = round(deg, 1)

    # --- Seat switch ---
    if "T_Seat" in decoded:
        out["seat_switch"] = int(decoded["T_Seat"])

    # --- Brake ---
    if "BrakeState" in decoded:
        out["brake"] = int(decoded["BrakeState"])

    # --- Battery voltage ---
    if "T_BatVolt" in decoded:
        v = decoded["T_BatVolt"]
        if 0 < v < 100:
            out["battery_voltage"] = round(v, 1)

    # --- Motor current ---
    if "T_BatCurr" in decoded:
        out["motor_current"] = round(decoded["T_BatCurr"], 1)

    # --- Motor temp: °C → °F ---
    if "T_motTemp_Lft" in decoded:
        c = decoded["T_motTemp_Lft"]
        if -40 <= c <= 200:
            out["motor_temp"] = round(c * 9 / 5 + 32, 1)

    # --- Battery SOC ---
    if "LiIoBMS_SOCwithSOH" in decoded:
        soc = decoded["LiIoBMS_SOCwithSOH"]
        if 0 <= soc <= 100:
            out["battery_soc"] = round(soc, 1)

    # --- Hour meter: seconds → hours ---
    if "TruckWorkTime" in decoded:
        secs = decoded["TruckWorkTime"]
        if secs > 0:
            out["hour_meter"] = round(secs / 3600, 1)

    # --- Battery temp: °C → °F ---
    if "battery_temperature" in decoded:
        c = decoded["battery_temperature"]
        if -40 <= c <= 100:
            out["battery_temp"] = round(c * 9 / 5 + 32, 1)

    # --- Throttle: pedal position, clamp 0–100 ---
    if "kec_accelerator_pedal_position" in decoded:
        pct = decoded["kec_accelerator_pedal_position"]
        out["throttle"] = round(max(0, min(100, pct)), 0)

    # --- Hydraulic motor torque (Nm) ---
    if "L1_estTorque" in decoded:
        torque = decoded["L1_estTorque"]
        if torque >= 0:
            out["hyd_torque"] = round(torque, 1)

    # --- Energy consumption (kWh/h) ---
    if "EConsum" in decoded:
        ec = decoded["EConsum"]
        if 0 <= ec <= 50:
            out["energy_consumption"] = round(ec, 2)

    # --- Remaining work time (minutes) ---
    if "RemWorkTime" in decoded:
        mins = decoded["RemWorkTime"]
        if 0 <= mins <= 2047:
            out["remaining_work_time"] = int(mins)

    # --- Truck hours (display controller): seconds → hours ---
    if "WorkTimeToBeDisplayed" in decoded:
        secs = decoded["WorkTimeToBeDisplayed"]
        if secs > 0:
            out["truck_hours"] = round(secs / 3600, 1)

    return out


def decode_frame(arb_id: int, data: bytes) -> dict:
    """Decode a raw CAN frame into dashboard signals.

    Returns a dict of {dashboard_key: value}, or empty dict if the
    frame is not relevant or decoding fails.
    """
    msg_def = _db_lookup.get(arb_id)
    if msg_def is None:
        return {}

    expected_len = msg_def.length
    if len(data) < expected_len:
        data = data + b"\x00" * (expected_len - len(data))

    try:
        decoded = msg_def.decode(data[:expected_len], decode_choices=False)
    except Exception:
        return {}

    return _map_to_dashboard(decoded)


# Load DBC definitions on import
_load_dbc()
