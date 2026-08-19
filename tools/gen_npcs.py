#!/usr/bin/env python3
"""Townsfolk sprites — reuses gen_characters.py's drawing engine (shared body
template + registered head styles) with new palettes, so NPCs share the same
pixel-art style as playable classes without duplicating the drawing code."""
import os
from PIL import Image

import gen_characters as gc

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "npcs")
PREVIEW_DIR = os.path.join(os.path.dirname(__file__), "_preview")

NPCS = [
    {"id": "baker", "head": "headband", "skin": "#e8b98a", "outfit": "#e6d9c2", "hat": "#caa46a", "accent": "#b5482b"},
    {"id": "barkeep", "head": "headband", "skin": "#c68642", "outfit": "#5c4326", "hat": "#8a8a8a", "accent": "#c9302c"},
    {"id": "watchman", "head": "helmet", "skin": "#d8a06e", "outfit": "#233a5e", "hat": "#8a97a8", "accent": "#d9b23c"},
    {"id": "finn", "head": "bandana", "skin": "#c68642", "outfit": "#3a2a1e", "hat": "#4a4a4a", "accent": "#d97b29"},
    {"id": "wren", "head": "headband", "skin": "#e0ac69", "outfit": "#2fa374", "hat": "#f2d24b", "accent": "#3ddcff"},
    {"id": "mira", "head": "headband", "skin": "#e8b98a", "outfit": "#4a3a6a", "hat": "#8a7a5a", "accent": "#6fa8ff"},
    {"id": "silas", "head": "bandana", "skin": "#c68642", "outfit": "#3a4a3a", "hat": "#4a4a4a", "accent": "#8a2e2e"},
    {"id": "kessa", "head": "bandana", "skin": "#d8a06e", "outfit": "#4a3f35", "hat": "#8a2e2e", "accent": "#c9a227"},
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    imgs = []
    for spec in NPCS:
        img = gc.draw_character(spec)
        img.save(os.path.join(OUT_DIR, f"{spec['id']}.png"))
        imgs.append((spec["id"], img))

    pad = 10
    sheet = Image.new("RGBA", (len(imgs) * (gc.W * 8 + pad) + pad, gc.H * 8 + pad * 2), (30, 30, 40, 255))
    x = pad
    for _name, img in imgs:
        big = img.resize((gc.W * 8, gc.H * 8), Image.NEAREST)
        sheet.paste(big, (x, pad), big)
        x += big.width + pad
    sheet.save(os.path.join(PREVIEW_DIR, "_npcs.png"))
    print(f"Wrote {len(NPCS)} npc sprites")


if __name__ == "__main__":
    main()
