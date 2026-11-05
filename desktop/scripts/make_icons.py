#!/usr/bin/env python3
"""Draws public/favicon.svg as desktop/icons/icon.ico, icon.icns and icon.png, with only the standard library."""
import struct
import zlib
from pathlib import Path

ICONS = Path(__file__).resolve().parents[1] / 'icons'
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
BACK, MARK, DOT = rgb('#19161d'), rgb('#dcb89a'), rgb('#df8799')


def in_rounded_square(x, y, r=16, w=64):
    cx, cy = min(max(x, r), w - r), min(max(y, r), w - r)
    return 0 <= x <= w and 0 <= y <= w and (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_triangle(x, y, a, b, c):
    side = lambda p, q: (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])
    d = side(a, b), side(b, c), side(c, a)
    return all(v >= 0 for v in d) or all(v <= 0 for v in d)


def colour(x, y):
    if not in_rounded_square(x, y):
        return None
    if (x - 32) ** 2 + (y - 49) ** 2 <= 16:
        return DOT
    if in_triangle(x, y, (10, 44), (32, 8), (54, 44)) and not in_triangle(x, y, (19, 39), (45, 39), (32, 17)):
        return MARK
    return BACK


def png(n):
    samples = 4 if n <= 256 else 2
    rows = bytearray()
    for j in range(n):
        rows.append(0)
        for i in range(n):
            r = g = b = a = 0
            for u in range(samples):
                for v in range(samples):
                    c = colour((i + (u + .5) / samples) * 64 / n, (j + (v + .5) / samples) * 64 / n)
                    if c:
                        r, g, b, a = r + c[0], g + c[1], b + c[2], a + 1
            rows += bytes((r // a, g // a, b // a, 255 * a // samples ** 2)) if a else bytes(4)
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))


def main():
    sizes = {n: png(n) for n in (16, 24, 32, 48, 64, 128, 256, 512, 1024)}
    ico_sizes = [256, 64, 48, 32, 24, 16]
    head, body, offset = struct.pack('<HHH', 0, 1, len(ico_sizes)), b'', 6 + 16 * len(ico_sizes)
    for n in ico_sizes:
        head += struct.pack('<BBBBHHII', n % 256, n % 256, 0, 0, 1, 32, len(sizes[n]), offset + len(body))
        body += sizes[n]
    (ICONS / 'icon.ico').write_bytes(head + body)
    icns = b''.join(t + struct.pack('>I', len(sizes[n]) + 8) + sizes[n]
                    for t, n in ((b'ic07', 128), (b'ic08', 256), (b'ic09', 512), (b'ic10', 1024)))
    (ICONS / 'icon.icns').write_bytes(b'icns' + struct.pack('>I', len(icns) + 8) + icns)
    (ICONS / 'icon.png').write_bytes(sizes[512])


if __name__ == '__main__':
    main()
