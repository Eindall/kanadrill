import { expandRomajiVariants, isRomajiCorrect, normalizeRomaji } from '@kanadrill/shared';
import { HIRAGANA_ENTRIES } from '@kanadrill/shared';

describe('normalizeRomaji', () => {
  it('ignore la casse, les espaces, tirets et apostrophes', () => {
    expect(normalizeRomaji('  SHI ')).toBe('shi');
    expect(normalizeRomaji("n'")).toBe('n');
    expect(normalizeRomaji('ky a')).toBe('kya');
    expect(normalizeRomaji('ｓｈｉ')).toBe('shi');
  });
});

describe('expandRomajiVariants', () => {
  it.each([
    ['shi', ['shi', 'si']],
    ['chi', ['chi', 'ti']],
    ['tsu', ['tsu', 'tu']],
    ['fu', ['fu', 'hu']],
    ['ji', ['ji', 'zi', 'di']],
    ['sha', ['sha', 'sya']],
    ['cho', ['cho', 'tyo', 'cyo']],
    ['ja', ['ja', 'jya', 'zya', 'dya']],
    ['jyu', ['jyu', 'ju', 'zyu']],
    ['n', ['n', 'nn']],
    ['ka', ['ka']],
  ])('%s', (reading, expected) => {
    expect(expandRomajiVariants(reading).sort()).toEqual([...expected].sort());
  });
});

describe('isRomajiCorrect', () => {
  it('accepte les variantes Hepburn / Nihon-shiki', () => {
    expect(isRomajiCorrect('shi', ['shi', 'si'])).toBe(true);
    expect(isRomajiCorrect('si', ['shi'])).toBe(true);
    expect(isRomajiCorrect('ti', ['chi'])).toBe(true);
    expect(isRomajiCorrect('tu', ['tsu'])).toBe(true);
    expect(isRomajiCorrect('hu', ['fu'])).toBe(true);
    expect(isRomajiCorrect('zya', ['ja'])).toBe(true);
    expect(isRomajiCorrect('nn', ['n'])).toBe(true);
    expect(isRomajiCorrect('wo', ['o', 'wo'])).toBe(true);
  });

  it('tolère casse et espaces', () => {
    expect(isRomajiCorrect(' SHI\n', ['shi'])).toBe(true);
  });

  it('refuse les mauvaises réponses et la réponse vide', () => {
    expect(isRomajiCorrect('', ['a'])).toBe(false);
    expect(isRomajiCorrect('   ', ['a'])).toBe(false);
    expect(isRomajiCorrect('sa', ['shi', 'si'])).toBe(false);
    expect(isRomajiCorrect('shii', ['shi'])).toBe(false);
    expect(isRomajiCorrect('ku', ['ka'])).toBe(false);
  });

  it('ne fait pas passer une lecture voisine pour juste (pas de confusion entre kana)', () => {
    expect(isRomajiCorrect('su', ['shi', 'si'])).toBe(false);
    expect(isRomajiCorrect('tsu', ['chi', 'ti'])).toBe(false);
    expect(isRomajiCorrect('ji', ['gi'])).toBe(false);
  });

  it('accepte la lecture de référence de chaque kana du seed, et rien d\'autre au hasard', () => {
    for (const [, readings] of HIRAGANA_ENTRIES) {
      for (const reading of readings) expect(isRomajiCorrect(reading, readings)).toBe(true);
      expect(isRomajiCorrect('zzz', readings)).toBe(false);
    }
  });
});
