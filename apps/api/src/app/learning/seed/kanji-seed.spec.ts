import { buildKanjiSeeds, kanjiRomajiReadings, loadKanjiRecords } from './kanji-seed';

describe('données des kanji', () => {
  const records = loadKanjiRecords();
  const seeds = buildKanjiSeeds(records);
  const seedOf = (character: string) => seeds.find((seed) => seed.character === character)!;

  it('contient les kanji de KANJIDIC2 qui ont un sens, sans doublon', () => {
    expect(seeds.length).toBeGreaterThan(10_000);
    expect(new Set(seeds.map((seed) => seed.character)).size).toBe(seeds.length);
    expect(seeds.every((seed) => seed.type === 'kanji' && seed.meanings.length > 0)).toBe(true);
  });

  it('classe les kanji par niveau JLPT, le N5 en premier', () => {
    const levels = seeds.map((seed) => seed.metadata['jlpt'] as string | null);
    const count = (level: string | null) => levels.filter((l) => l === level).length;
    // Les listes de Jonathan Waller : environ 80, 170, 370, 370 et 1230 kanji.
    expect(count('N5')).toBeGreaterThan(70);
    expect(count('N4')).toBeGreaterThan(150);
    expect(count('N3')).toBeGreaterThan(300);
    expect(count('N2')).toBeGreaterThan(300);
    expect(count('N1')).toBeGreaterThan(1000);
    expect(count(null)).toBeGreaterThan(7000);
    const order = [...seeds].sort((a, b) => a.sortOrder - b.sortOrder).map((seed) => seed.metadata['jlpt']);
    const firstOther = order.indexOf(null);
    expect(order.slice(0, count('N5')).every((l) => l === 'N5')).toBe(true);
    expect(order.slice(firstOther).every((l) => l === null)).toBe(true);
    expect(new Set(seeds.map((seed) => seed.sortOrder)).size).toBe(seeds.length);
    expect(Math.min(...seeds.map((seed) => seed.sortOrder))).toBeGreaterThan(1999); // après les 208 kana
  });

  it('prend les sens français quand il y en a, sinon anglais', () => {
    const hi = seedOf('日');
    expect(hi.meanings.slice(0, 2)).toEqual(['jour', 'soleil']);
    expect(hi.metadata['language']).toBe('fr');
    const english = seeds.filter((seed) => seed.metadata['language'] === 'en');
    expect(english.length).toBeGreaterThan(5000);
    expect(english.every((seed) => seed.meanings.length > 0)).toBe(true);
  });

  it('garde les lectures à afficher et les tracés dans les métadonnées', () => {
    const hi = seedOf('日');
    expect(hi.metadata).toMatchObject({ jlpt: 'N5', grade: 1, strokeCount: 4, on: ['ニチ', 'ジツ'] });
    expect((hi.metadata['strokes'] as unknown[]).length).toBe(4);
    expect((hi.metadata['kun'] as string[])[0]).toBe('ひ');
  });
});

describe('kanjiRomajiReadings', () => {
  it('accepte les lectures on et kun, avec et sans okurigana', () => {
    const readings = kanjiRomajiReadings(['セイ', 'ショウ'], ['い.きる', 'う.まれる', 'なま', '-う']);
    expect(readings).toEqual(expect.arrayContaining(['sei', 'shou', 'ikiru', 'i', 'umareru', 'u', 'nama']));
  });

  it('retire les marqueurs de préfixe et de suffixe', () => {
    expect(kanjiRomajiReadings([], ['-び', 'ひと-'])).toEqual(['bi', 'hito']);
  });

  it('accepte aussi la voyelle longue abrégée (jou ou jo)', () => {
    expect(kanjiRomajiReadings(['ジョウ'], [])).toEqual(['jou', 'jo']);
    expect(kanjiRomajiReadings(['シュウ'], [])).toEqual(['shuu', 'shu']);
  });

  it('place la première lecture on en tête', () => {
    expect(kanjiRomajiReadings(['ニチ', 'ジツ'], ['ひ'])[0]).toBe('nichi');
  });

  it('ne produit rien pour un kanji sans lecture', () => {
    expect(kanjiRomajiReadings([], [])).toEqual([]);
  });
});
