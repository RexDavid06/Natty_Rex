#!/usr/bin/env python3
"""Generate dependency-free PWA icons for Nattyrex.

The mark is a dark rounded tile with a lime panel and a barbell glyph. It uses
simple signed-distance shapes with supersampling so no image library is needed.
Run from the repository root:

    python frontend/scripts/generate_icons.py
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"
BG = (10, 10, 10)
LIME = (198, 249, 74)
DARK = (9, 12, 8)


def rounded_box(x: float, y: float, box: tuple[float, float, float, float], radius: float) -> float:
    left, top, right, bottom = box
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    half_w = (right - left) / 2 - radius
    half_h = (bottom - top) / 2 - radius
    dx = abs(x - cx) - half_w
    dy = abs(y - cy) - half_h
    outside = (max(dx, 0) ** 2 + max(dy, 0) ** 2) ** 0.5
    inside = min(max(dx, dy), 0)
    return outside + inside - radius


def over(dst: tuple[float, float, float], src: tuple[int, int, int], coverage: float):
    coverage = max(0.0, min(1.0, coverage))
    return tuple(dst[i] * (1 - coverage) + src[i] * coverage for i in range(3))


def render(size: int, maskable: bool) -> bytes:
    scale = 512 / size
    inset = 104 if maskable else 64
    panel = (inset, inset, 512 - inset, 512 - inset)
    panel_radius = 82 if maskable else 100
    bar = (132, 238, 380, 274)
    bar_radius = 18
    plate_left = (148, 172, 192, 340)
    plate_right = (320, 172, 364, 340)
    plate_radius = 18
    collar_left = (112, 198, 140, 314)
    collar_right = (372, 198, 400, 314)
    collar_radius = 12

    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            x = (px + 0.5) * scale
            y = (py + 0.5) * scale
            color = (float(BG[0]), float(BG[1]), float(BG[2]))
            if rounded_box(x, y, panel, panel_radius) <= 0:
                color = (float(LIME[0]), float(LIME[1]), float(LIME[2]))
                for box, radius in (
                    (bar, bar_radius),
                    (plate_left, plate_radius),
                    (plate_right, plate_radius),
                    (collar_left, collar_radius),
                    (collar_right, collar_radius),
                ):
                    if rounded_box(x, y, box, radius) <= 0:
                        color = (float(DARK[0]), float(DARK[1]), float(DARK[2]))
            row.extend(int(round(channel)) for channel in color)
        rows.append(bytes(row))
    raw = b"".join(rows)
    return zlib.compress(raw, 9)


def chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, size: int, maskable: bool = False) -> None:
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", render(size, maskable))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")


def main() -> None:
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    write_png(OUT / "icons" / "icon-192.png", 192)
    write_png(OUT / "icons" / "icon-512.png", 512)
    write_png(OUT / "icons" / "icon-maskable-512.png", 512, maskable=True)
    write_png(OUT / "apple-touch-icon.png", 180)
    (OUT / "favicon.svg").write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0a0a0a"/>
  <rect x="8" y="8" width="48" height="48" rx="13" fill="#c6f94a"/>
  <g fill="#090c08">
    <rect x="16" y="30" width="32" height="4" rx="2"/>
    <rect x="18" y="22" width="6" height="20" rx="2"/>
    <rect x="40" y="22" width="6" height="20" rx="2"/>
    <rect x="13" y="26" width="4" height="12" rx="2"/>
    <rect x="47" y="26" width="4" height="12" rx="2"/>
  </g>
</svg>
"""
    )
    print("wrote public/favicon.svg")


if __name__ == "__main__":
    main()
