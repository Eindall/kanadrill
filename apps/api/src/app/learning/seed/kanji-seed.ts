import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { JLPT_LEVELS, kanaToRomaji, toHiragana, type JlptLevel, type StrokeDto } from '@kanadrill/shared';
import type { ItemSeed } from './seed-items';

/** Un kanji tel que `tools/generate-kanji-data.py` l'écrit dans `assets/kanji.json.gz`. */
export interface KanjiRecord {
  c: string;
  on: string[];
  kun: string[];
  fr: string[];
  en: string[];
  jlpt: number | null;
  grade: number | null;
  freq: number | null;
  sc: number | null;
  strokes: StrokeDto[];
}

const DATA_FILE = 'kanji.json.gz';

/**
 * Le fichier de données : à côté du bundle en production (`dist/apps/api/assets`, copié par webpack), dans
 * `src/assets` quand le code tourne depuis les sources (tests).
 */
export function kanjiDataPath(): string {
  const candidates = [
    join(__dirname, 'assets', DATA_FILE),
    join(__dirname, '..', 'assets', DATA_FILE),
    join(__dirname, '..', '..', '..', 'assets', DATA_FILE),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`Données des kanji introuvables (${DATA_FILE}) : ${candidates.join(', ')}`);
  return found;
}

export function loadKanjiRecords(path = kanjiDataPath()): KanjiRecord[] {
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf-8')) as KanjiRecord[];
}

/** « 1 » à « 5 » dans la source → « N1 » à « N5 ». */
const levelOf = (jlpt: number | null): JlptLevel | null => (jlpt === null ? null : (JLPT_LEVELS[5 - jlpt] ?? null));

/**
 * Formes écrites d'une lecture KANJIDIC2 : les tirets (« -び », « ひと- ») marquent un suffixe ou un préfixe et
 * disparaissent ; le point sépare la racine de l'okurigana (« い.きる » : « い » ou « いきる »).
 */
function readingForms(reading: string): string[] {
  const core = reading.replace(/^-|-$/g, '');
  return core.includes('.') ? [core.split('.')[0], core.replace('.', '')] : [core];
}

/** Romaji d'une lecture, avec la variante sans voyelle longue (« jou » et « jo » : on ne tape pas toujours ō). */
function romajiForms(kana: string): string[] {
  const romaji = kanaToRomaji(kana);
  if (!/^[a-z]+$/.test(romaji)) return [];
  const short = romaji.replace(/ou/g, 'o').replace(/oo/g, 'o').replace(/uu/g, 'u');
  return short === romaji ? [romaji] : [romaji, short];
}

/**
 * Tous les romaji acceptés pour les lectures d'un kanji (on et kun, avec ou sans okurigana), sans doublon.
 * Le premier est la lecture « de référence » : la première lecture on, sinon la première kun.
 */
export function kanjiRomajiReadings(on: readonly string[], kun: readonly string[]): string[] {
  const kana = [...on.map(toHiragana), ...kun].flatMap(readingForms);
  return [...new Set(kana.flatMap(romajiForms))];
}

/** Rang pédagogique : N5 d'abord, puis N4… N1, puis le reste ; dans chaque groupe, niveau scolaire, fréquence, code. */
function byLearningOrder(a: KanjiRecord, b: KanjiRecord): number {
  const rank = (record: KanjiRecord) => (record.jlpt === null ? 0 : record.jlpt); // 5 (N5) avant 1 (N1)
  const group = (record: KanjiRecord) => (record.jlpt === null ? 99 : 6 - rank(record));
  return (
    group(a) - group(b) ||
    (a.grade ?? 99) - (b.grade ?? 99) ||
    (a.freq ?? 99_999) - (b.freq ?? 99_999) ||
    a.c.codePointAt(0)! - b.c.codePointAt(0)!
  );
}

/** Les kanji commencent bien après les kana (208) dans l'ordre pédagogique. */
const KANJI_ORDER_OFFSET = 10_000;

export function buildKanjiSeeds(records: readonly KanjiRecord[] = loadKanjiRecords()): ItemSeed[] {
  return [...records].sort(byLearningOrder).map((record, index): ItemSeed => {
    const french = record.fr.length > 0;
    return {
      type: 'kanji',
      character: record.c,
      readings: kanjiRomajiReadings(record.on, record.kun),
      // Français quand KANJIDIC2 en a, sinon anglais : le premier sens est celui du QCM.
      meanings: french ? record.fr : record.en,
      sortOrder: KANJI_ORDER_OFFSET + index,
      metadata: {
        jlpt: levelOf(record.jlpt),
        grade: record.grade,
        frequency: record.freq,
        strokeCount: record.sc,
        language: french ? 'fr' : 'en',
        on: record.on,
        kun: record.kun,
        strokes: record.strokes,
      },
    };
  });
}
