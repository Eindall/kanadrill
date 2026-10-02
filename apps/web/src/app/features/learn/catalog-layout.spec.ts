import type { CatalogItemDto, KanaGroup } from '@kanadrill/shared';
import { layoutCatalog, masterySummary } from './catalog-layout';

let counter = 0;
const item = (group: KanaGroup, type: 'hiragana' | 'katakana' = 'hiragana', mastery: CatalogItemDto['mastery'] = 'unseen'): CatalogItemDto => ({
  id: String(counter++),
  type,
  character: String(counter),
  reading: 'x',
  group,
  mastery,
});
const many = (group: KanaGroup, count: number, type: 'hiragana' | 'katakana' = 'hiragana') =>
  Array.from({ length: count }, () => item(group, type));

describe('layoutCatalog', () => {
  it('ne garde que l\'écriture demandée et ordonne les groupes base, dakuten, yōon', () => {
    const items = [...many('yoon', 33), ...many('base', 46), ...many('voiced', 25), ...many('base', 46, 'katakana')];
    const layout = layoutCatalog(items, 'hiragana');
    expect(layout.map((l) => l.group)).toEqual(['base', 'voiced', 'yoon']);
    expect(layout.map((l) => l.columns)).toEqual([5, 5, 3]);
  });

  it('reproduit le tableau de base (や ゆ よ en colonnes a u o, わ を aux extrémités, ん seul)', () => {
    const base = many('base', 46);
    const [{ cells }] = layoutCatalog(base, 'hiragana');
    const row = (n: number) => cells.slice(n * 5, n * 5 + 5);
    expect(row(0)).toEqual(base.slice(0, 5));
    expect(row(7)).toEqual([base[35], null, base[36], null, base[37]]); // や _ ゆ _ よ
    expect(row(8)).toEqual(base.slice(38, 43)); // ら り る れ ろ
    expect(row(9)).toEqual([base[43], null, null, null, base[44]]); // わ … を
    expect(row(10)).toEqual([base[45], null, null, null, null]); // ん
    expect(cells.filter(Boolean)).toHaveLength(46);
  });

  it('range les autres groupes à la suite, sans trou', () => {
    const layouts = layoutCatalog([...many('voiced', 25), ...many('yoon', 33)], 'hiragana');
    expect(layouts[0].cells).toHaveLength(25);
    expect(layouts[0].cells.every(Boolean)).toBe(true);
    expect(layouts[1].cells).toHaveLength(33);
    expect(layouts[1].cells.every(Boolean)).toBe(true);
  });

  it('ne perd aucun élément si la table change (éléments en trop ou en moins)', () => {
    expect(layoutCatalog(many('base', 48), 'hiragana')[0].cells.filter(Boolean)).toHaveLength(48);
    expect(layoutCatalog(many('base', 3), 'hiragana')[0].cells.filter(Boolean)).toHaveLength(3);
    expect(layoutCatalog(many('yoon', 4), 'hiragana')[0].cells).toHaveLength(6); // complété à la ligne
  });

  it('renvoie une liste vide sans élément', () => {
    expect(layoutCatalog([], 'hiragana')).toEqual([]);
  });
});

describe('masterySummary', () => {
  it('compte chaque niveau', () => {
    const items = [item('base', 'hiragana', 'learning'), item('base', 'hiragana', 'learning'), item('base', 'hiragana', 'mastered'), item('base')];
    expect(masterySummary(items)).toEqual({ unseen: 1, learning: 2, known: 0, mastered: 1 });
  });
});
