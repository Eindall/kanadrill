#!/usr/bin/env python3
"""Génère les icônes de l'application (PWA) dans apps/web/public/icons.

Un « か » clair sur fond encre, avec un point rouge sceau en bas à droite (jamais en haut à droite : il se lirait comme un dakuten, « が ») (couleurs de apps/web/src/styles.css).
Les PNG sont commités : ce script ne sert qu'à les régénérer (Pillow + une police japonaise, ici Noto Sans CJK JP).

    python3 tools/generate-icons.py [chemin/vers/NotoSansCJK-Regular.ttc]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

INK, PAPER, SEAL = '#1b2437', '#ffffff', '#b3362b'
FONT = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
OUT = Path(__file__).resolve().parent.parent / 'apps/web/public/icons'
MASTER = 1024  # dessiné en grand puis réduit (lissage)


def render(glyph_ratio: float, dot_center: tuple[float, float], dot_ratio: float) -> Image.Image:
    image = Image.new('RGB', (MASTER, MASTER), INK)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, int(MASTER * glyph_ratio), index=0)  # index 0 = variante japonaise
    left, top, right, bottom = draw.textbbox((0, 0), 'か', font=font)
    # Centre l'encre du glyphe (et non sa boîte typographique) au milieu de l'image.
    x = (MASTER - (right - left)) / 2 - left
    y = (MASTER - (bottom - top)) / 2 - top
    draw.text((x, y), 'か', font=font, fill=PAPER)
    cx, cy, r = dot_center[0] * MASTER, dot_center[1] * MASTER, dot_ratio * MASTER
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=SEAL)
    return image


def save(image: Image.Image, name: str, size: int) -> None:
    image.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print(f'{name} ({size}x{size})')


OUT.mkdir(parents=True, exist_ok=True)
standard = render(glyph_ratio=0.62, dot_center=(0.78, 0.79), dot_ratio=0.065)
# « maskable » : tout le contenu doit tenir dans le cercle de sécurité (80 % centraux) que les lanceurs peuvent rogner.
maskable = render(glyph_ratio=0.5, dot_center=(0.70, 0.71), dot_ratio=0.055)

save(standard, 'icon-192.png', 192)
save(standard, 'icon-512.png', 512)
save(maskable, 'icon-maskable-512.png', 512)
save(standard, 'apple-touch-icon.png', 180)
