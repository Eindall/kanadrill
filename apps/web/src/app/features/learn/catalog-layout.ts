import { KANA_GROUPS, type CatalogItemDto, type ItemType, type KanaGroup, type MasteryLevel } from '@kanadrill/shared';

export const GROUP_LABELS: Record<KanaGroup, string> = {
  base: 'Les kana de base',
  voiced: 'Avec dakuten et handakuten (゛ ゜)',
  yoon: 'Les yōon (avec ゃ ゅ ょ)',
};

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  unseen: 'Pas encore vu',
  learning: 'En cours',
  known: 'Connu',
  mastered: 'Solide',
};

/** Nombre de segments remplis (0 à 3) dans l'indicateur de maîtrise. */
export const MASTERY_STEPS: Record<MasteryLevel, number> = { unseen: 0, learning: 1, known: 2, mastered: 3 };

export interface GroupLayout {
  group: KanaGroup;
  columns: number;
  /** Cases de la grille, ligne par ligne ; `null` = case vide (le tableau de kana a des trous). */
  cells: Array<CatalogItemDto | null>;
}

/** Colonnes (0 = a … 4 = o) occupées par chaque ligne du tableau de base : や ゆ よ, わ を, puis ん seul. */
const BASE_ROWS: number[][] = [
  ...Array.from({ length: 7 }, () => [0, 1, 2, 3, 4]),
  [0, 2, 4],
  [0, 1, 2, 3, 4],
  [0, 4],
  [0],
];

const FLAT_COLUMNS: Record<KanaGroup, number> = { base: 5, voiced: 5, yoon: 3 };

/** Place les éléments dans le tableau des lignes données ; ce qui dépasse est ajouté à la suite, rien n'est perdu. */
function place(items: CatalogItemDto[], rows: number[][], columns: number): Array<CatalogItemDto | null> {
  const cells: Array<CatalogItemDto | null> = [];
  let next = 0;
  for (const row of rows) {
    if (next >= items.length) break;
    const line: Array<CatalogItemDto | null> = Array(columns).fill(null);
    for (const column of row) if (next < items.length) line[column] = items[next++];
    cells.push(...line);
  }
  const rest = items.slice(next);
  cells.push(...rest);
  // Complète la dernière ligne pour garder un tableau rectangulaire.
  while (cells.length % columns !== 0) cells.push(null);
  return cells;
}

/** Les éléments d'une écriture rangés par groupe, avec la disposition du tableau de kana. */
export function layoutCatalog(items: CatalogItemDto[], type: ItemType): GroupLayout[] {
  const ofType = items.filter((item) => item.type === type);
  return KANA_GROUPS.flatMap((group) => {
    const inGroup = ofType.filter((item) => item.group === group);
    if (inGroup.length === 0) return [];
    const columns = FLAT_COLUMNS[group];
    const rows = group === 'base' ? BASE_ROWS : Array.from({ length: Math.ceil(inGroup.length / columns) }, () => Array.from({ length: columns }, (_, i) => i));
    return [{ group, columns, cells: place(inGroup, rows, columns) }];
  });
}

/** Répartition de la maîtrise (pour le résumé en tête de page). */
export function masterySummary(items: CatalogItemDto[]): Record<MasteryLevel, number> {
  const summary: Record<MasteryLevel, number> = { unseen: 0, learning: 0, known: 0, mastered: 0 };
  for (const item of items) summary[item.mastery] += 1;
  return summary;
}
