#!/usr/bin/env python3
"""Textured building sprites — shingled/banded roof, plank or brick walls,
paned windows, paneled door. Real pixel art at each building's exact
pixel size (sizes come from TownScene's building layout)."""
import math
import os
from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "buildings")
PREVIEW_DIR = os.path.join(os.path.dirname(__file__), "_preview")

OUTLINE = (18, 15, 14, 255)
GLOW = (255, 233, 168, 255)


def shade(color, factor):
    r, g, b = color[:3]
    return (max(0, min(255, int(r * factor))), max(0, min(255, int(g * factor))), max(0, min(255, int(b * factor))), 255)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[int(x), int(y)] = color

    def hline(self, x0, x1, y, color):
        for x in range(int(x0), int(x1)):
            self.set(x, y, color)

    def rect(self, x, y, w, h, color):
        for iy in range(y, y + h):
            self.hline(x, x + w, iy, color)


def draw_roof(c, w, roof_h, roof_color, banded=True):
    apex_x = w / 2
    for y in range(roof_h):
        t = y / roof_h
        half = apex_x * t
        left = apex_x - half
        right = apex_x + half
        band = shade(roof_color, 0.82) if banded and (y // 3) % 2 == 1 else roof_color
        c.hline(round(left), round(right), y, band)
        c.set(round(left) - 1, y, OUTLINE)
        c.set(round(right), y, OUTLINE)
    c.hline(round(apex_x - 1), round(apex_x + 1), 0, shade(roof_color, 1.25))
    c.hline(0, w, roof_h, OUTLINE)


def draw_wall_plank(c, w, roof_h, wall_color):
    h = c.h
    c.rect(0, roof_h, w, h - roof_h, wall_color)
    for y in range(roof_h + 3, h, 4):
        c.hline(0, w, y, shade(wall_color, 0.85))
    for x in (1, w - 2):
        for y in range(roof_h, h):
            c.set(x, y, shade(wall_color, 0.8))
    c.hline(0, w, roof_h, OUTLINE)
    for y in range(roof_h, h):
        c.set(0, y, OUTLINE)
        c.set(w - 1, y, OUTLINE)
    c.hline(0, w, h - 1, OUTLINE)


def draw_wall_brick(c, w, roof_h, wall_color):
    h = c.h
    c.rect(0, roof_h, w, h - roof_h, wall_color)
    mortar = shade(wall_color, 0.72)
    brick_w, brick_h = 10, 5
    y = roof_h
    row = 0
    while y < h:
        c.hline(0, w, y, mortar)
        offset = 0 if row % 2 == 0 else brick_w // 2
        x = -offset
        while x < w:
            for iy in range(y + 1, min(y + brick_h, h)):
                c.set(x + brick_w, iy, mortar)
            x += brick_w
        y += brick_h
        row += 1
    c.hline(0, w, roof_h, OUTLINE)
    for iy in range(roof_h, h):
        c.set(0, iy, OUTLINE)
        c.set(w - 1, iy, OUTLINE)
    c.hline(0, w, h - 1, OUTLINE)


def draw_window(c, cx, cy, size, frame_color):
    half = size // 2
    x0, y0 = cx - half, cy - half
    c.rect(x0, y0, size, size, GLOW)
    for i in range(size):
        c.set(x0 + i, y0, frame_color)
        c.set(x0 + i, y0 + size - 1, frame_color)
        c.set(x0, y0 + i, frame_color)
        c.set(x0 + size - 1, y0 + i, frame_color)
    mid = size // 2
    for i in range(size):
        c.set(x0 + i, y0 + mid, shade(frame_color, 1.3))
        c.set(x0 + mid, y0 + i, shade(frame_color, 1.3))


def draw_door(c, w, h, door_w, door_h, door_color, accent):
    x0 = round(w / 2 - door_w / 2)
    y0 = h - door_h
    c.rect(x0, y0, door_w, door_h, door_color)
    for x in range(x0, x0 + door_w):
        c.set(x, y0, OUTLINE)
    for y in range(y0, h):
        c.set(x0, y, OUTLINE)
        c.set(x0 + door_w - 1, y, OUTLINE)
    panel_w = door_w - 4
    panel_h = (door_h - 8) // 2
    for i, py in enumerate((y0 + 3, y0 + 5 + panel_h)):
        for x in range(x0 + 2, x0 + 2 + panel_w):
            c.set(x, py, shade(door_color, 0.8))
            c.set(x, py + panel_h - 1, shade(door_color, 0.8))
        for y in range(py, py + panel_h):
            c.set(x0 + 2, y, shade(door_color, 0.8))
            c.set(x0 + 2 + panel_w - 1, y, shade(door_color, 0.8))
    c.set(x0 + door_w - 4, h - door_h // 2, accent)


def draw_building(w, h, material, wall_color, roof_color, door_color, accent=(255, 209, 102, 255)):
    c = Canvas(w, h)
    roof_h = round(h * 0.28)
    draw_roof(c, w, roof_h, roof_color)
    if material == "brick":
        draw_wall_brick(c, w, roof_h, wall_color)
    else:
        draw_wall_plank(c, w, roof_h, wall_color)
    win_y = roof_h + round((h - roof_h) * 0.3)
    win_size = max(6, round(w * 0.12))
    draw_window(c, round(w * 0.22), win_y, win_size, OUTLINE)
    draw_window(c, round(w * 0.78), win_y, win_size, OUTLINE)
    draw_door(c, w, h, round(w * 0.22), round(h - roof_h - h * 0.05), door_color, accent)
    return c.img


BUILDINGS = [
    {"key": "bld-0", "w": 96, "h": 80, "material": "plank", "wall": "#8a5a3c", "roof": "#5c2e1a", "door": "#3a2010"},
    {"key": "bld-1", "w": 96, "h": 72, "material": "plank", "wall": "#b08e57", "roof": "#7a5230", "door": "#4a2f18"},
    {"key": "bld-2", "w": 88, "h": 76, "material": "plank", "wall": "#6a7d9c", "roof": "#38455c", "door": "#1f2733"},
    {"key": "bld-3", "w": 100, "h": 84, "material": "plank", "wall": "#8f6a9c", "roof": "#4f3059", "door": "#2a1a30"},
    {"key": "bld-4", "w": 90, "h": 90, "material": "brick", "wall": "#555a66", "roof": "#2a2d33", "door": "#14161a"},
    {"key": "bld-5", "w": 70, "h": 78, "material": "brick", "wall": "#6b4a3a", "roof": "#332420", "door": "#1c1109"},
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    imgs = []
    for spec in BUILDINGS:
        img = draw_building(
            spec["w"], spec["h"], spec["material"],
            hex_to_rgb(spec["wall"]), hex_to_rgb(spec["roof"]), hex_to_rgb(spec["door"]),
        )
        img.save(os.path.join(OUT_DIR, f"{spec['key']}.png"))
        imgs.append(img)

    pad = 12
    total_w = sum(i.width for i in imgs) * 2 + pad * (len(imgs) + 1)
    max_h = max(i.height for i in imgs) * 2 + pad * 2
    sheet = Image.new("RGBA", (total_w, max_h), (30, 30, 40, 255))
    x = pad
    for img in imgs:
        big = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
        sheet.paste(big, (x, pad), big)
        x += big.width + pad
    sheet.save(os.path.join(PREVIEW_DIR, "_buildings.png"))
    print(f"Wrote {len(BUILDINGS)} building sprites")


if __name__ == "__main__":
    main()
