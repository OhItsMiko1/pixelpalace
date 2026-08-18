#!/usr/bin/env python3
"""Textured 16x16 ground tiles (grass, path) — real pixel art, not flat fills."""
import os
import random
from PIL import Image

SIZE = 16
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "tiles")
PREVIEW_DIR = os.path.join(os.path.dirname(__file__), "_preview")


def shade(color, factor):
    r, g, b = color
    return (max(0, min(255, int(r * factor))), max(0, min(255, int(g * factor))), max(0, min(255, int(b * factor))))


def make_grass(seed=1):
    rng = random.Random(seed)
    base = (58, 125, 63)
    img = Image.new("RGBA", (SIZE, SIZE), (*base, 255))
    px = img.load()
    # mottled darker patches
    for _ in range(14):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        px[x, y] = shade(base, rng.uniform(0.75, 0.88))
    # small blade tufts: 2px vertical darker + 1px lighter tip
    for _ in range(6):
        x, y = rng.randrange(1, SIZE - 1), rng.randrange(2, SIZE - 1)
        px[x, y] = shade(base, 0.78)
        px[x, y - 1] = shade(base, 1.18)
    return img


def make_path(seed=2):
    rng = random.Random(seed)
    base = (194, 160, 106)
    img = Image.new("RGBA", (SIZE, SIZE), (*base, 255))
    px = img.load()
    for _ in range(10):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        px[x, y] = shade(base, rng.uniform(0.8, 0.9))
    # small pebbles: 2x1 darker blobs with a highlight pixel
    for _ in range(5):
        x, y = rng.randrange(1, SIZE - 2), rng.randrange(1, SIZE - 1)
        c = shade(base, 0.72)
        px[x, y] = c
        px[x + 1, y] = c
        px[x, y - 1] = shade(base, 1.15)
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    tiles = {"grass": make_grass(), "path": make_path()}
    strip = Image.new("RGBA", (SIZE * 6 * len(tiles) + 8 * (len(tiles) + 1), SIZE * 6 + 16), (30, 30, 40, 255))
    x = 8
    for name, img in tiles.items():
        img.save(os.path.join(OUT_DIR, f"{name}.png"))
        # tiled preview so seams are visible
        tiled = Image.new("RGBA", (SIZE * 4, SIZE * 4))
        for ty in range(4):
            for tx in range(4):
                tiled.paste(img, (tx * SIZE, ty * SIZE))
        big = tiled.resize((SIZE * 4 * 3, SIZE * 4 * 3), Image.NEAREST)
        big.save(os.path.join(PREVIEW_DIR, f"tile_{name}.png"))
    print("Wrote grass.png and path.png")


if __name__ == "__main__":
    main()
