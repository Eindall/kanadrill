import { Rating, State } from 'ts-fsrs';
import { CARD_STATE, REVIEW_RATING } from '@kanadrill/shared';
import { HIRAGANA_ENTRIES, toKatakana } from './kana.data';
import { buildKanaSeeds } from './seed-items';

describe('données des kana', () => {
  it('contient 104 kana par écriture (base 46 + dakuten/handakuten 25 + yōon 33)', () => {
    expect(HIRAGANA_ENTRIES).toHaveLength(104);
    expect(buildKanaSeeds()).toHaveLength(208);
  });

  it('n\'a aucun doublon (type, caractère) et des lectures valides', () => {
    const seeds = buildKanaSeeds();
    expect(new Set(seeds.map((s) => `${s.type}:${s.character}`)).size).toBe(seeds.length);
    for (const seed of seeds) {
      expect(seed.readings.length).toBeGreaterThan(0);
      expect(new Set(seed.readings).size).toBe(seed.readings.length);
      for (const reading of seed.readings) expect(reading).toMatch(/^[a-z]+$/);
    }
  });

  it('définit un ordre d\'introduction strict : hiragana d\'abord, dans l\'ordre de la table', () => {
    const seeds = buildKanaSeeds();
    expect(new Set(seeds.map((s) => s.sortOrder)).size).toBe(seeds.length);
    const byOrder = [...seeds].sort((x, y) => x.sortOrder - y.sortOrder);
    expect(byOrder.slice(0, 3).map((s) => s.character)).toEqual(['あ', 'い', 'う']);
    expect(byOrder.findIndex((s) => s.type === 'katakana')).toBe(104);
    expect(byOrder.slice(104).every((s) => s.type === 'katakana')).toBe(true);
  });

  it('dérive correctement le katakana', () => {
    expect(toKatakana('あ')).toBe('ア');
    expect(toKatakana('きゃ')).toBe('キャ');
    expect(toKatakana('ぽ')).toBe('ポ');
    expect(toKatakana('ん')).toBe('ン');
  });

  it('couvre les cas particuliers', () => {
    const byChar = new Map(HIRAGANA_ENTRIES);
    expect(byChar.get('し')).toEqual(['shi', 'si']);
    expect(byChar.get('じゃ')).toEqual(['ja', 'jya', 'zya']);
    expect(byChar.get('きょ')).toEqual(['kyo']);
    expect(byChar.get('を')).toContain('o');
  });
});

describe('constantes partagées vs ts-fsrs', () => {
  it('ont les mêmes valeurs', () => {
    expect(REVIEW_RATING).toEqual({ Again: Rating.Again, Hard: Rating.Hard, Good: Rating.Good, Easy: Rating.Easy });
    expect(CARD_STATE).toEqual({
      New: State.New,
      Learning: State.Learning,
      Review: State.Review,
      Relearning: State.Relearning,
    });
  });
});
