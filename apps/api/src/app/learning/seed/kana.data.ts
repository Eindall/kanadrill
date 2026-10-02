/**
 * Données des kana. Chaque entrée : [hiragana, romaji acceptés]. Le premier romaji est la lecture de
 * référence (Hepburn) ; les suivants sont des variantes courantes acceptées en saisie (si, tu, hu, zi…).
 * Le katakana est dérivé du hiragana (décalage Unicode de 0x60) : une seule table à maintenir.
 * Hors périmètre : kana rares ou désuets (ゐ ゑ ヴ) et extensions du katakana (ファ, ティ…).
 */
import type { KanaGroup } from '@kanadrill/shared';

export type KanaEntry = readonly [hiragana: string, readings: readonly string[]];

const BASE: KanaEntry[] = [
  ['あ', ['a']], ['い', ['i']], ['う', ['u']], ['え', ['e']], ['お', ['o']],
  ['か', ['ka']], ['き', ['ki']], ['く', ['ku']], ['け', ['ke']], ['こ', ['ko']],
  ['さ', ['sa']], ['し', ['shi', 'si']], ['す', ['su']], ['せ', ['se']], ['そ', ['so']],
  ['た', ['ta']], ['ち', ['chi', 'ti']], ['つ', ['tsu', 'tu']], ['て', ['te']], ['と', ['to']],
  ['な', ['na']], ['に', ['ni']], ['ぬ', ['nu']], ['ね', ['ne']], ['の', ['no']],
  ['は', ['ha']], ['ひ', ['hi']], ['ふ', ['fu', 'hu']], ['へ', ['he']], ['ほ', ['ho']],
  ['ま', ['ma']], ['み', ['mi']], ['む', ['mu']], ['め', ['me']], ['も', ['mo']],
  ['や', ['ya']], ['ゆ', ['yu']], ['よ', ['yo']],
  ['ら', ['ra']], ['り', ['ri']], ['る', ['ru']], ['れ', ['re']], ['ろ', ['ro']],
  ['わ', ['wa']], ['を', ['wo', 'o']], ['ん', ['n', 'nn']],
];

/** Dakuten (゛) et handakuten (゜). */
const VOICED: KanaEntry[] = [
  ['が', ['ga']], ['ぎ', ['gi']], ['ぐ', ['gu']], ['げ', ['ge']], ['ご', ['go']],
  ['ざ', ['za']], ['じ', ['ji', 'zi']], ['ず', ['zu']], ['ぜ', ['ze']], ['ぞ', ['zo']],
  ['だ', ['da']], ['ぢ', ['ji', 'di', 'zi']], ['づ', ['zu', 'du', 'dzu']], ['で', ['de']], ['ど', ['do']],
  ['ば', ['ba']], ['び', ['bi']], ['ぶ', ['bu']], ['べ', ['be']], ['ぼ', ['bo']],
  ['ぱ', ['pa']], ['ぴ', ['pi']], ['ぷ', ['pu']], ['ぺ', ['pe']], ['ぽ', ['po']],
];

/** Yōon : kana en i + petit ゃ / ゅ / ょ. La consonne (avec ses variantes) se combine avec a / u / o. */
const YOON_CONSONANTS: ReadonlyArray<readonly [kana: string, consonants: readonly string[]]> = [
  ['き', ['ky']], ['し', ['sh', 'sy']], ['ち', ['ch', 'ty']], ['に', ['ny']], ['ひ', ['hy']], ['み', ['my']],
  ['り', ['ry']], ['ぎ', ['gy']], ['じ', ['j', 'jy', 'zy']], ['び', ['by']], ['ぴ', ['py']],
];
const YOON_SMALL: ReadonlyArray<readonly [kana: string, vowel: string]> = [['ゃ', 'a'], ['ゅ', 'u'], ['ょ', 'o']];

const YOON: KanaEntry[] = YOON_CONSONANTS.flatMap(([kana, consonants]) =>
  YOON_SMALL.map(([small, vowel]): KanaEntry => [kana + small, consonants.map((c) => c + vowel)]),
);

/** Les entrées par groupe, dans l'ordre d'apprentissage. */
export const KANA_GROUP_ENTRIES: Readonly<Record<KanaGroup, readonly KanaEntry[]>> = {
  base: BASE,
  voiced: VOICED,
  yoon: YOON,
};

export const HIRAGANA_ENTRIES: readonly KanaEntry[] = [...BASE, ...VOICED, ...YOON];

/** Convertit du hiragana en katakana (même lectures). */
export function toKatakana(hiragana: string): string {
  return [...hiragana].map((c) => String.fromCodePoint(c.codePointAt(0)! + 0x60)).join('');
}
