"""CAN signal decoder — reads signals.json and decodes raw CAN frames."""

import json
import os

SIGNALS_PATH = os.path.join(os.path.dirname(__file__), "signals.json")


def load_signals(path=SIGNALS_PATH):
    with open(path) as f:
        raw = json.load(f)
    signals = {}
    for arb_id_str, sig in raw.items():
        arb_id = int(arb_id_str, 16)
        signals[arb_id] = sig
    return signals


def decode_message(arb_id, data, signals):
    """Decode a CAN message into a dict of {signal_name: value}.

    Returns None if the arbitration ID is not in the signal map.
    """
    sig = signals.get(arb_id)
    if sig is None:
        return None

    offset = sig["byte_offset"]
    length = sig["byte_length"]
    raw_bytes = data[offset : offset + length]

    # Big-endian unsigned int from bytes
    raw_value = int.from_bytes(raw_bytes, byteorder="big", signed=sig.get("signed", False))

    value = raw_value * sig["scale"] + sig["offset"]

    return {sig["name"]: round(value, 4)}
