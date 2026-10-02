#!/usr/bin/env python3
"""Génère les tracés des kana (ordre des traits) à partir de KanjiVG.

Sortie : apps/api/src/app/learning/seed/kana-glyphs.data.ts (commité ; ce script ne sert qu'à le régénérer).
Pour chaque kana simple (hiragana U+3041–3096, katakana U+30A1–30FA) : les traits dans l'ordre, chacun avec
son tracé SVG (`d`, repère 109 × 109 de KanjiVG) et la position de son numéro. Les yōon (きゃ…) ne sont pas
ici : le seed les compose à partir des glyphes simples (voir seed/kana-strokes.ts).

Données : KanjiVG © Ulrich Apel, licence CC BY-SA 3.0 (https://kanjivg.tagaini.net). Le fichier généré en est une
œuvre dérivée, sous la même licence ; la page « À propos » de l'application en fait mention.

    python3 tools/generate-kana-strokes.py [dossier-de-cache]

Le cache (par défaut /tmp/kanjivg-cache) évite de retélécharger les SVG lors d'une régénération.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{code:05x}.svg'
OUT = Path(__file__).resolve().parent.parent / 'apps/api/src/app/learning/seed/kana-glyphs.data.ts'
CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/kanjivg-cache')

PATH_RE = re.compile(r'<path id="kvg:[0-9a-f]+-s(\d+)"[^>]*? d="([^"]+)"')
NUMBER_RE = re.compile(r'<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">(\d+)</text>')


def fetch(code: int) -> str | None:
    cached = CACHE / f'{code:05x}.svg'
    if cached.exists():
        return cached.read_text(encoding='utf-8')
    try:
        with urllib.request.urlopen(BASE_URL.format(code=code), timeout=30) as response:
            svg = response.read().decode('utf-8')
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise
    CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(svg, encoding='utf-8')
    return svg


def parse(char: str, svg: str) -> list[dict]:
    paths = {int(n): d for n, d in PATH_RE.findall(svg)}
    numbers = {int(n): [float(x), float(y)] for x, y, n in NUMBER_RE.findall(svg)}
    expected = list(range(1, len(paths) + 1))
    if sorted(paths) != expected or sorted(numbers) != expected:
        raise SystemExit(f'{char} : traits et numéros incohérents ({sorted(paths)} / {sorted(numbers)})')
    return [{'d': paths[n], 'n': numbers[n]} for n in expected]


glyphs: dict[str, list[dict]] = {}
for code in [*range(0x3041, 0x3097), *range(0x30A1, 0x30FB)]:
    char = chr(code)
    svg = fetch(code)
    if svg is None:
        print(f'absent de KanjiVG : {char} (U+{code:04X})', file=sys.stderr)
        continue
    glyphs[char] = parse(char, svg)

lines = [
    '/* eslint-disable */',
    '/**',
    ' * Tracés des kana simples (ordre des traits), générés par tools/generate-kana-strokes.py — ne pas modifier à la main.',
    ' * Source : KanjiVG © Ulrich Apel, CC BY-SA 3.0 (https://kanjivg.tagaini.net). Repère 109 × 109.',
    ' */',
    "import type { StrokeDto } from '@kanadrill/shared';",
    '',
    '// prettier-ignore',
    'export const KANA_GLYPHS: Readonly<Record<string, readonly StrokeDto[]>> = {',
]
for char, strokes in glyphs.items():
    lines.append(f"  '{char}': {json.dumps(strokes, ensure_ascii=False, separators=(',', ':'))},".replace('"d"', 'd').replace('"n"', 'n').replace('\\"', '"'))
lines.append('};')
lines.append('')
OUT.write_text('\n'.join(lines), encoding='utf-8')
print(f'{len(glyphs)} glyphes écrits dans {OUT}')
