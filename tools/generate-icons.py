#!/usr/bin/env python3
"""Génère les icônes de l'application (PWA) dans apps/web/public/icons.

Un « か » clair sur fond encre, avec un point rouge sceau en bas à droite (jamais en haut à droite : il se lirait comme un dakuten, « が ») (couleurs de apps/web/src/styles.css).
Génère aussi le favicon (apps/web/public/favicon.ico) : le « あ » de la page de connexion, dans son carré blanc à
bordure encre, avec le petit tampon rouge en coin.
Les fichiers générés sont commités : ce script ne sert qu'à les régénérer (Pillow + une police japonaise, ici Noto Sans CJK JP).

    python3 tools/generate-icons.py [chemin/vers/NotoSansCJK-Regular.ttc]
"""
import io
import struct
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


# --- Favicon : le motif de la page de connexion (login-page.ts), lisible dès 16 px ---
SERIF = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'  # gras : les pleins et déliés fins disparaîtraient à 16 px
PUBLIC = OUT.parent


def render_favicon() -> Image.Image:
    border = int(MASTER * 0.06)
    image = Image.new('RGB', (MASTER, MASTER), INK)
    draw = ImageDraw.Draw(image)
    draw.rectangle((border, border, MASTER - border - 1, MASTER - border - 1), fill=PAPER)

    font = ImageFont.truetype(SERIF, int(MASTER * 0.78), index=0)
    left, top, right, bottom = draw.textbbox((0, 0), 'あ', font=font)
    # Un peu décalé vers le haut à gauche pour laisser sa place au tampon.
    x = (MASTER - (right - left)) / 2 - left - MASTER * 0.05
    y = (MASTER - (bottom - top)) / 2 - top - MASTER * 0.06
    draw.text((x, y), 'あ', font=font, fill=INK)

    # Tampon rouge incliné de 5°, dans le coin bas droit, comme sur la page de connexion.
    stamp_size = int(MASTER * 0.27)
    stamp = Image.new('RGBA', (stamp_size, stamp_size), SEAL)
    stamp = stamp.rotate(5, resample=Image.BICUBIC, expand=True)
    image.paste(stamp, (MASTER - border - stamp.width + int(MASTER * 0.02), MASTER - border - stamp.height + int(MASTER * 0.02)), stamp)
    return image


def write_ico(path: Path, image: Image.Image, sizes: tuple[int, ...]) -> None:
    """ICO à images PNG intégrées, chaque taille réduite depuis le grand format (meilleur rendu que le redimensionnement de Pillow)."""
    blobs = []
    for size in sizes:
        buffer = io.BytesIO()
        image.resize((size, size), Image.LANCZOS).save(buffer, format='PNG', optimize=True)
        blobs.append(buffer.getvalue())
    header = struct.pack('<HHH', 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries = b''
    for size, blob in zip(sizes, blobs):
        entries += struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    path.write_bytes(header + entries + b''.join(blobs))
    print(f'{path.name} ({", ".join(f"{s}x{s}" for s in sizes)}, {path.stat().st_size} octets)')


write_ico(PUBLIC / 'favicon.ico', render_favicon(), (16, 32, 48))
