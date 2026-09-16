#!/usr/bin/env python3
"""Inflate the frozen benchmark.json and verify SHA-256.

Git stores the sidecar as ordered fragments:
  benchmark.json.gz.b64.part001, part002, …
because a single 178 KiB POST does not go through the connector.

Fragments are concatenated in name order. Newlines (Git EOF) are
ignored; they are not part of the payload.

The inflated file MUST hash to:
  3a700609dc264e2df8eae515ff9289a834c402023b4d80f222f32f60d0326ecf
"""
from __future__ import annotations
import base64, gzip, hashlib, sys
from pathlib import Path

EXPECTED = "3a700609dc264e2df8eae515ff9289a834c402023b4d80f222f32f60d0326ecf"
HERE = Path(__file__).resolve().parent


def sidecar_text() -> str:
    parts = sorted(HERE.glob("benchmark.json.gz.b64.part[0-9][0-9][0-9]"))
    if parts:
        return "".join(p.read_text() for p in parts)
    single = HERE / "benchmark.json.gz.b64"
    if single.exists():
        return single.read_text()
    sys.exit("missing benchmark.json.gz.b64 or .partNNN fragments")


def main():
    out_path = HERE / "benchmark.json"
    text = sidecar_text().replace("\r", "").replace("\n", "")
    raw = base64.b64decode(text)
    data = gzip.decompress(raw)
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED:
        sys.exit(f"SHA-256 mismatch: {digest} != {EXPECTED}")
    if len(data) != 1397245:
        sys.exit(f"size mismatch: {len(data)} != 1397245")
    out_path.write_bytes(data)
    print(f"wrote {out_path} ({len(data)} bytes)")
    print(f"sha256 {digest}")


if __name__ == "__main__":
    main()
