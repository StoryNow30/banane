#!/usr/bin/env python3
"""Inflate the frozen benchmark.json and verify SHA-256.

Git stores benchmark.json.gz.b64 because the uncompressed JSON is 1 397 245 bytes.
The inflated file MUST hash to:
  3a700609dc264e2df8eae515ff9289a834c402023b4d80f222f32f60d0326ecf
"""
from __future__ import annotations
import base64, gzip, hashlib, sys
from pathlib import Path

EXPECTED = "3a700609dc264e2df8eae515ff9289a834c402023b4d80f222f32f60d0326ecf"
HERE = Path(__file__).resolve().parent

def main():
    b64_path = HERE / "benchmark.json.gz.b64"
    out_path = HERE / "benchmark.json"
    raw = base64.b64decode(b64_path.read_text().strip())
    data = gzip.decompress(raw)
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED:
        sys.exit(f"SHA-256 mismatch: {digest} != {EXPECTED}")
    out_path.write_bytes(data)
    print(f"wrote {out_path} ({len(data)} bytes)")
    print(f"sha256 {digest}")

if __name__ == "__main__":
    main()
