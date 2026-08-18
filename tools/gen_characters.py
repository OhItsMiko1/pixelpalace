#!/usr/bin/env python3
"""Hand-authored pixel-art character sprites for Pixel Palace.

Draws a 16x24 chibi RPG character per class: shared body/limb template,
per-class headwear silhouette, simple 2-tone shading, 1px outline.
Outputs native-resolution PNGs (no upscale) so Phaser's nearest-neighbor
pixelArt rendering handles scaling at runtime, matching the game's
existing 16x24 texture convention.
"""
import os
from PIL import Image

W, H = 16, 24
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "characters")
PREVIEW_DIR = os.path.join(os.path.dirname(__file__), "_preview")

OUTLINE = (26, 22, 20, 255)


def shade(color, factor):
    r, g, b = color
    return (max(0, min(255, int(r * factor))), max(0, min(255, int(g * factor))), max(0, min(255, int(b * factor))))


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x, y, color):
        if 0 <= x < W and 0 <= y < H:
            self.px[x, y] = color

    def rect(self, x, y, w, h, color, outline=True):
        if outline:
            for ix in range(x - 1, x + w + 1):
                self.set(ix, y - 1, OUTLINE)
                self.set(ix, y + h, OUTLINE)
            for iy in range(y - 1, y + h + 1):
                self.set(x - 1, iy, OUTLINE)
                self.set(x + w, iy, OUTLINE)
        for iy in range(y, y + h):
            for ix in range(x, x + w):
                self.set(ix, iy, color)

    def shadow_strip(self, x, y, w, h, color, rows=2):
        """Darken the bottom `rows` of a rect for cheap 2-tone shading."""
        dark = shade(color, 0.72)
        for iy in range(y + h - rows, y + h):
            for ix in range(x, x + w):
                self.set(ix, iy, dark)

    def save(self, path):
        self.img.save(path)


def draw_body(c, palette):
    outfit = palette["outfit"]
    skin = palette["skin"]
    boot = (40, 32, 30)
    accent = palette["accent"]

    # torso
    c.rect(4, 9, 8, 8, outfit)
    c.shadow_strip(4, 9, 8, 8, outfit, rows=3)
    # belt / accent stripe
    for ix in range(4, 12):
        c.set(ix, 14, accent)
        c.set(ix, 15, shade(accent, 0.8))

    # arms
    c.rect(2, 10, 2, 6, skin)
    c.shadow_strip(2, 10, 2, 6, skin, rows=2)
    c.rect(12, 10, 2, 6, skin)
    c.shadow_strip(12, 10, 2, 6, skin, rows=2)

    # legs / boots
    c.rect(5, 17, 2, 6, boot)
    c.rect(9, 17, 2, 6, boot)
    c.shadow_strip(5, 17, 2, 6, boot, rows=2)
    c.shadow_strip(9, 17, 2, 6, boot, rows=2)


def draw_face(c, palette, face_color=None, eye_color=None):
    skin = face_color or palette["skin"]
    eye = eye_color or OUTLINE
    c.rect(5, 4, 6, 5, skin)
    c.shadow_strip(5, 4, 6, 5, skin, rows=1)
    c.set(6, 6, eye)
    c.set(9, 6, eye)


HEAD_STYLES = {}


def register(name):
    def deco(fn):
        HEAD_STYLES[name] = fn
        return deco

    return deco


@register("helmet")
def head_helmet(c, palette):
    hat = palette["hat"]
    accent = palette["accent"]
    c.rect(4, 0, 8, 4, hat)
    c.shadow_strip(4, 0, 8, 4, hat, rows=1)
    for ix in range(4, 12):
        c.set(ix, 3, accent)
    c.rect(3, 4, 1, 4, hat, outline=False)
    c.rect(12, 4, 1, 4, hat, outline=False)
    c.set(3, 3, OUTLINE)
    c.set(12, 3, OUTLINE)
    draw_face(c, palette)


@register("wizard_hat")
def head_wizard(c, palette):
    hat = palette["hat"]
    widths = [2, 4, 6, 8]
    for i, w in enumerate(widths):
        y = i
        x = 8 - w // 2
        c.rect(x, y, w, 1, hat, outline=(i == len(widths) - 1))
    c.rect(3, 3, 10, 1, shade(hat, 0.85), outline=True)
    draw_face(c, palette)


@register("hood")
def head_hood(c, palette):
    hat = palette["hat"]
    c.rect(4, 0, 8, 5, hat)
    c.shadow_strip(4, 0, 8, 5, hat, rows=2)
    draw_face(c, palette, face_color=shade(palette["skin"], 0.85))


@register("headband")
def head_headband(c, palette):
    hair = palette["hat"]
    accent = palette["accent"]
    c.rect(4, 0, 8, 3, hair)
    for ix in range(4, 12):
        c.set(ix, 1, accent)
    # ponytail
    c.rect(12, 1, 1, 4, hair, outline=True)
    draw_face(c, palette)


@register("bandana")
def head_bandana(c, palette):
    hair = palette["hat"]
    accent = palette["accent"]
    c.rect(4, 0, 8, 3, accent)
    c.shadow_strip(4, 0, 8, 3, accent, rows=1)
    c.rect(12, 1, 1, 2, accent, outline=True)
    draw_face(c, palette)
    # eye patch over one eye
    c.set(6, 6, OUTLINE)
    c.set(6, 5, OUTLINE)


@register("tall_hood")
def head_tall_hood(c, palette):
    hat = palette["hat"]
    c.rect(7, 0, 2, 2, hat, outline=True)
    c.rect(4, 2, 8, 3, hat, outline=True)
    c.shadow_strip(4, 2, 8, 3, hat, rows=1)
    draw_face(c, palette, face_color=shade(palette["skin"], 0.8), eye_color=palette["accent"])


@register("plumed_hood")
def head_plumed_hood(c, palette):
    hat = palette["hat"]
    accent = palette["accent"]
    c.rect(4, 0, 8, 5, hat)
    c.shadow_strip(4, 0, 8, 5, hat, rows=2)
    c.rect(12, 0, 1, 3, accent, outline=True)
    draw_face(c, palette, face_color=shade(palette["skin"], 0.85))


@register("plague_mask")
def head_plague_mask(c, palette):
    hat = palette["hat"]
    mask = palette["accent"]
    c.rect(4, 0, 8, 5, hat)
    c.shadow_strip(4, 0, 8, 5, hat, rows=2)
    c.rect(5, 4, 6, 4, mask)
    c.shadow_strip(5, 4, 6, 4, mask, rows=1)
    # beak
    c.rect(7, 6, 2, 1, shade(mask, 0.85), outline=True)
    c.rect(6, 7, 4, 1, shade(mask, 0.85), outline=True)
    c.set(6, 5, OUTLINE)
    c.set(9, 5, OUTLINE)


CHARACTERS = [
    {"id": "warrior", "head": "helmet", "skin": "#e0ac69", "outfit": "#8a1f1f", "hat": "#5c5c66", "accent": "#c9a227"},
    {"id": "mage", "head": "wizard_hat", "skin": "#f1c27d", "outfit": "#2b3a8f", "hat": "#1c2a6e", "accent": "#6fd3ff"},
    {"id": "rogue", "head": "hood", "skin": "#c68642", "outfit": "#2f2f2f", "hat": "#25321f", "accent": "#4c9a2a"},
    {"id": "huntress", "head": "headband", "skin": "#d8a06e", "outfit": "#2e5339", "hat": "#5c3a1e", "accent": "#d97b29"},
    {"id": "plague-doctor", "head": "plague_mask", "skin": "#cfcfcf", "outfit": "#1c1c1c", "hat": "#2a2a2a", "accent": "#c9b896"},
    {"id": "bandit-lord", "head": "bandana", "skin": "#b97a56", "outfit": "#5c1a1a", "hat": "#1a1a1a", "accent": "#1a1a1a"},
    {"id": "necromancer", "head": "tall_hood", "skin": "#a9a4c9", "outfit": "#1f1330", "hat": "#160c22", "accent": "#3ddc84"},
    {"id": "corrupted-duelist", "head": "plumed_hood", "skin": "#e6b98c", "outfit": "#4a0e0e", "hat": "#300808", "accent": "#ffd166"},
]


def build_palette(spec):
    return {
        "skin": hex_to_rgb(spec["skin"]),
        "outfit": hex_to_rgb(spec["outfit"]),
        "hat": hex_to_rgb(spec["hat"]),
        "accent": hex_to_rgb(spec["accent"]),
    }


def draw_character(spec):
    c = Canvas()
    palette = build_palette(spec)
    draw_body(c, palette)
    HEAD_STYLES[spec["head"]](c, palette)
    return c.img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for spec in CHARACTERS:
        img = draw_character(spec)
        img.save(os.path.join(OUT_DIR, f"{spec['id']}.png"))
        preview = img.resize((W * 8, H * 8), Image.NEAREST)
        preview.save(os.path.join(PREVIEW_DIR, f"{spec['id']}.png"))
    # contact sheet
    cols = 4
    rows = (len(CHARACTERS) + cols - 1) // cols
    pad = 10
    sheet = Image.new("RGBA", (cols * (W * 8 + pad) + pad, rows * (H * 8 + pad) + pad), (30, 30, 40, 255))
    for i, spec in enumerate(CHARACTERS):
        img = draw_character(spec).resize((W * 8, H * 8), Image.NEAREST)
        x = pad + (i % cols) * (W * 8 + pad)
        y = pad + (i // cols) * (H * 8 + pad)
        sheet.paste(img, (x, y), img)
    sheet.save(os.path.join(PREVIEW_DIR, "_contact_sheet.png"))
    print(f"Wrote {len(CHARACTERS)} sprites to {OUT_DIR}")


if __name__ == "__main__":
    main()
