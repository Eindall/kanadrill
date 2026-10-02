import { HIRAGANA_ENTRIES, toKatakana } from './kana.data';
import { KANA_GLYPHS } from './kana-glyphs.data';
import { kanaStrokes, transformPath } from './kana-strokes';

const NUMBER = /-?\d*\.?\d+/g;
const numbers = (d: string) => (d.match(NUMBER) ?? []).map(Number);

describe('transformPath', () => {
  it('met à l\'échelle et translate les coordonnées absolues, seulement à l\'échelle les relatives', () => {
    // M absolu (10,20) ; c relatif : trois points de contrôle
    expect(transformPath('M10,20c1,2,3,4,5,6', { scale: 0.5, x: 100, y: 200 })).toBe('M105,210c0.5,1,1.5,2,2.5,3');
  });

  it('distingue x et y pour H / V, et gère les répétitions implicites', () => {
    expect(transformPath('H10V20h4v6', { scale: 2, x: 1, y: 2 })).toBe('H21V42h8v12');
    expect(transformPath('M1,2 3,4', { scale: 1, x: 10, y: 20 })).toBe('M11,22,13,24');
  });

  it('refuse les arcs', () => {
    expect(() => transformPath('M0,0a1,1,0,0,1,2,2', { scale: 1, x: 0, y: 0 })).toThrow();
  });
});

describe('kanaStrokes', () => {
  it('couvre les 208 kana du seed, avec au moins un trait chacun', () => {
    for (const [hiragana] of HIRAGANA_ENTRIES) {
      expect(kanaStrokes(hiragana).length).toBeGreaterThan(0);
      expect(kanaStrokes(toKatakana(hiragana)).length).toBeGreaterThan(0);
    }
  });

  it('donne le bon nombre de traits (あ 3, い 2, か 3, が 5)', () => {
    expect(kanaStrokes('あ')).toHaveLength(3);
    expect(kanaStrokes('い')).toHaveLength(2);
    expect(kanaStrokes('か')).toHaveLength(3);
    expect(kanaStrokes('が')).toHaveLength(5);
  });

  it('renvoie une copie : modifier le résultat ne touche pas les données', () => {
    const strokes = kanaStrokes('あ');
    strokes[0].n[0] = -1;
    expect(KANA_GLYPHS['あ'][0].n[0]).not.toBe(-1);
  });

  it('compose un yōon : traits du kana puis du petit kana, rangés dans le repère 109 × 109', () => {
    const strokes = kanaStrokes('きゃ');
    expect(strokes).toHaveLength(kanaStrokes('き').length + kanaStrokes('ゃ').length);
    for (const stroke of strokes) {
      for (const value of [...numbers(stroke.d).slice(0, 2), ...stroke.n]) {
        expect(value).toBeGreaterThanOrEqual(-5);
        expect(value).toBeLessThanOrEqual(115);
      }
    }
    // Le petit kana est en bas à droite du kana de base.
    const base = kanaStrokes('き').length;
    const small = strokes.slice(base);
    expect(Math.min(...small.map((s) => s.n[0]))).toBeGreaterThan(50);
    expect(Math.min(...small.map((s) => s.n[1]))).toBeGreaterThan(50);
    expect(Math.max(...strokes.slice(0, base).map((s) => s.n[0]))).toBeLessThan(70);
  });

  it('compose aussi les yōon en katakana', () => {
    expect(kanaStrokes('キャ')).toHaveLength(kanaStrokes('キ').length + kanaStrokes('ャ').length);
  });

  it('renvoie un tableau vide pour un caractère inconnu', () => {
    expect(kanaStrokes('漢')).toEqual([]);
    expect(kanaStrokes('あ漢')).toEqual([]);
  });
});
