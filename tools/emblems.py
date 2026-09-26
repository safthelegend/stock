#!/usr/bin/env python3
"""Turn the school emblems in assets/schools/ into one-colour masks.

The team page paints every emblem in the brand green with a CSS mask, which
reads only a picture's transparency. A JPEG has none, and a full-colour logo
would come out as one solid blob, so each raster emblem is rebuilt here as a
transparent PNG: the logo's dark ink becomes solid, its paper becomes clear.

    python3 tools/emblems.py

Writes assets/schools/mask/<name>.png for every .png/.jpg/.jpeg/.webp in
assets/schools/. SVGs are skipped: an SVG whose light areas are real holes
(like Stuyvesant's) already works as a mask and is used as-is.

No dependencies beyond the Python standard library and macOS's `sips`, which
decodes every source format into a plain bitmap this script can read.
"""
import os, re, struct, subprocess, sys, tempfile, zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "schools")
OUT = os.path.join(SRC, "mask")
GREEN = (0x2E, 0x5A, 0x22)          # brand green; the CSS mask recolours it per theme

# How each emblem's shape is read. "ink": dark marks are the logo (drawn on a
# light or transparent background; light marks inside become cut-outs).
# "alpha": the logo is every non-transparent pixel, whatever its colour, for
# logos drawn in light colours on a transparent background.
MODE = {"wellsprings-school": "alpha"}
INK_SOLID, INK_CLEAR = 0.45, 0.78   # luminance: below SOLID is opaque, above CLEAR is clear


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", os.path.splitext(name)[0].lower()).strip("-")


def read_bmp(path):
    """Top-down or bottom-up, 24-bit BGR or 32-bit BGRA, as sips writes them."""
    b = open(path, "rb").read()
    off = struct.unpack_from("<I", b, 10)[0]
    w, h = struct.unpack_from("<ii", b, 18)
    bpp = struct.unpack_from("<H", b, 28)[0]
    if bpp not in (24, 32):
        sys.exit("unsupported bitmap depth %d in %s" % (bpp, path))
    step = bpp // 8
    stride = (w * step + 3) & ~3
    rows = []
    for y in range(abs(h)):
        base = off + y * stride
        row = []
        for x in range(w):
            p = base + x * step
            bl, g, r = b[p], b[p + 1], b[p + 2]
            a = b[p + 3] if step == 4 else 255
            row.append((r, g, bl, a))
        rows.append(row)
    if h > 0:
        rows.reverse()
    return w, abs(h), rows


def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in rows)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


def mask_alpha(px, mode):
    r, g, b, a = px
    if mode == "alpha":
        return a
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    k = (INK_CLEAR - lum) / (INK_CLEAR - INK_SOLID)
    return int(round(a * max(0.0, min(1.0, k))))


def convert(name):
    key = slug(name)
    mode = MODE.get(key, "ink")
    with tempfile.TemporaryDirectory() as tmp:
        bmp = os.path.join(tmp, "e.bmp")
        subprocess.run(["sips", "-s", "format", "bmp", os.path.join(SRC, name), "--out", bmp],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        w, h, rows = read_bmp(bmp)
    alpha = [[mask_alpha(px, mode) for px in row] for row in rows]
    # Crop to the logo itself (plus a hair of padding) so every emblem sits
    # the same size in its slot regardless of how much margin the file had.
    ys = [y for y in range(h) if any(v > 24 for v in alpha[y])]
    xs = [x for x in range(w) if any(alpha[y][x] > 24 for y in range(h))]
    if not ys or not xs:
        print("  skipped %s: nothing opaque found" % name)
        return
    pad = 2
    x0, x1 = max(0, xs[0] - pad), min(w, xs[-1] + 1 + pad)
    y0, y1 = max(0, ys[0] - pad), min(h, ys[-1] + 1 + pad)
    out_rows = [[GREEN + (alpha[y][x],) for x in range(x0, x1)] for y in range(y0, y1)]
    dest = os.path.join(OUT, key + ".png")
    write_png(dest, x1 - x0, y1 - y0, out_rows)
    print("  %-28s -> mask/%s.png  (%dx%d, %s)" % (name, key, x1 - x0, y1 - y0, mode))


def main():
    os.makedirs(OUT, exist_ok=True)
    names = sorted(n for n in os.listdir(SRC)
                   if os.path.isfile(os.path.join(SRC, n)) and n.lower().endswith((".png", ".jpg", ".jpeg", ".webp")))
    print("Building emblem masks:")
    for n in names:
        convert(n)


if __name__ == "__main__":
    main()
