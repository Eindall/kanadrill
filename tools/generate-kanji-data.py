#!/usr/bin/env python3
"""Génère les données des kanji : apps/api/src/assets/kanji.json.gz (commité ; ce script ne sert qu'à le régénérer).

Sources (téléchargées dans un cache, par défaut /tmp/kanjidata-cache) :
  - KANJIDIC2 (lectures on / kun, sens français et anglais, niveau scolaire, fréquence, nombre de traits) :
    © groupe EDRDG, licence https://www.edrdg.org/edrdg/licence.html
  - KanjiVG (ordre des traits, repère 109 × 109) : © Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net
  - niveaux JLPT N5 à N1 : listes de Jonathan Waller (http://www.tanos.co.uk/jlpt/), reprises dans le dépôt
    davidluzgouveia/kanji-data (licence MIT). KANJIDIC2 n'a que les 4 anciens niveaux : N3 et N2 y sont confondus.

Le fichier généré est une œuvre dérivée de ces sources : leurs licences s'appliquent (voir la page « À propos »).

    python3 tools/generate-kanji-data.py [dossier-de-cache]

Format : une liste d'objets
    c (caractère), on / kun (lectures en kana, notation KANJIDIC2 : « ひ.く », « -び »), fr / en (sens),
    jlpt (5 à 1 ou null), grade, freq, sc (nombre de traits), strokes ([{d, n}] comme pour les kana).
Seuls les sens français sont gardés quand il y en a, sinon les anglais : le seed choisit.
"""
import gzip
import io
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'apps/api/src/assets/kanji.json.gz'
CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/kanjidata-cache')
SOURCES = {
    'kanjidic2.xml.gz': 'http://www.edrdg.org/kanjidic/kanjidic2.xml.gz',
    'kanjivg-main.zip': 'https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714-main.zip',
    'kanji-data.json': 'https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json',
}


def download(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        print(f'téléchargement de {name}…', file=sys.stderr)
        with urllib.request.urlopen(SOURCES[name], timeout=180) as response:
            path.write_bytes(response.read())
    return path


PATH_RE = re.compile(r'<path id="kvg:[0-9a-f]+-s(\d+)"[^>]*? d="([^"]+)"')
NUMBER_RE = re.compile(r'<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">(\d+)</text>')
# Mentions de radical, pas des sens : « radical (no. 72) ».
RADICAL_RE = re.compile(r'radical[^()]*\(no\.\s*\d+\)', re.IGNORECASE)


def parse_strokes(svg: str) -> list[dict]:
    paths = {int(n): d for n, d in PATH_RE.findall(svg)}
    numbers = {int(n): [float(x), float(y)] for x, y, n in NUMBER_RE.findall(svg)}
    expected = list(range(1, len(paths) + 1))
    if not paths or sorted(paths) != expected or sorted(numbers) != expected:
        return []
    return [{'d': paths[n], 'n': numbers[n]} for n in expected]


def main() -> None:
    jlpt_new = {c: v.get('jlpt_new') for c, v in json.loads(download('kanji-data.json').read_text(encoding='utf-8')).items()}

    strokes: dict[str, list[dict]] = {}
    with zipfile.ZipFile(download('kanjivg-main.zip')) as archive:
        for name in archive.namelist():
            match = re.fullmatch(r'kanji/([0-9a-f]{5})\.svg', name)
            if match:
                strokes[chr(int(match.group(1), 16))] = parse_strokes(archive.read(name).decode('utf-8'))

    with gzip.open(download('kanjidic2.xml.gz')) as source:
        root = ET.parse(source).getroot()

    kanji = []
    for character in root.findall('character'):
        literal = character.findtext('literal')
        misc = character.find('misc')
        on, kun, fr, en = [], [], [], []
        for group in character.findall('reading_meaning/rmgroup'):
            for reading in group.findall('reading'):
                target = {'ja_on': on, 'ja_kun': kun}.get(reading.get('r_type'))
                if target is not None and reading.text:
                    target.append(reading.text)
            for meaning in group.findall('meaning'):
                lang = meaning.get('m_lang')
                if meaning.text and not RADICAL_RE.search(meaning.text) and lang in (None, 'fr'):
                    (fr if lang == 'fr' else en).append(meaning.text.strip())
        if not fr and not en:
            continue  # rien à faire réviser : ni sens français ni anglais

        def number(tag: str) -> int | None:
            value = misc.findtext(tag) if misc is not None else None
            return int(value) if value else None

        entry = {
            'c': literal,
            'on': on,
            'kun': kun,
            'fr': fr,
            'en': en,
            'jlpt': jlpt_new.get(literal),
            'grade': number('grade'),
            'freq': number('freq'),
            'sc': number('stroke_count'),
            'strokes': strokes.get(literal, []),
        }
        kanji.append(entry)

    kanji.sort(key=lambda k: ord(k['c']))
    payload = json.dumps(kanji, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    with gzip.GzipFile(OUT, 'wb', compresslevel=9, mtime=0) as target:  # mtime=0 : même contenu, même fichier
        target.write(payload)

    with_strokes = sum(1 for k in kanji if k['strokes'])
    levels = {level: sum(1 for k in kanji if k['jlpt'] == level) for level in (5, 4, 3, 2, 1)}
    print(f'{len(kanji)} kanji ({with_strokes} avec tracé, {sum(1 for k in kanji if k["fr"])} avec sens français), '
          f'JLPT {levels}, {OUT.stat().st_size / 1e6:.1f} Mo compressés ({len(payload) / 1e6:.1f} Mo bruts)')


main()
