#!/usr/bin/env python3
"""Build favicon assets from the approved Sykerbos protea logo.

Generated during GitHub Pages deployment, keeping the original brand image
as the only source of truth and avoiding binary-file edits to the repository.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / "assets/brand/sykerbos-logo-transparent-exact.png").convert("RGBA")
# The approved 360x300 logo contains the protea above the wordmark.
# Crop only the flower; never redraw or alter its petals.
w, h = source.size
flower = source.crop((int(w * 0.16), int(h * 0.015), int(w * 0.84), int(h * 0.76)))

def square(size, margin):
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    inner = size - 2 * margin
    ratio = min(inner / flower.width, inner / flower.height)
    scaled = flower.resize((max(1, round(flower.width * ratio)),
                            max(1, round(flower.height * ratio))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas

square(32, 1).save(ROOT / "favicon-32x32.png")
square(180, 12).convert("RGB").save(ROOT / "apple-touch-icon.png")
square(192, 12).save(ROOT / "favicon-192x192.png")
icon = square(256, 6)
icon.save(ROOT / "favicon.ico", format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64)])
print("Generated Sykerbos favicon.ico, favicon-32x32.png, apple-touch-icon.png and favicon-192x192.png")
