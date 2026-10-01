import { DataSource } from 'typeorm';
import type { ItemType } from '@kanadrill/shared';
import { Item } from '../item.entity';
import { HIRAGANA_ENTRIES, toKatakana } from './kana.data';

interface ItemSeed {
  type: ItemType;
  character: string;
  readings: string[];
  meanings: string[];
  sortOrder: number;
}

/** Les katakana viennent après tous les hiragana (jeu de 104 kana + marge). */
const KATAKANA_OFFSET = 1000;

export function buildKanaSeeds(): ItemSeed[] {
  // Ordre d'introduction : tout le hiragana, puis tout le katakana, chacun dans l'ordre de la table.
  const hiragana = HIRAGANA_ENTRIES.map(([character, readings], index): ItemSeed => ({
    type: 'hiragana',
    character,
    readings: [...readings],
    meanings: [],
    sortOrder: index,
  }));
  const katakana = HIRAGANA_ENTRIES.map(([character, readings], index): ItemSeed => ({
    type: 'katakana',
    character: toKatakana(character),
    readings: [...readings],
    meanings: [],
    sortOrder: KATAKANA_OFFSET + index,
  }));
  return [...hiragana, ...katakana];
}

/**
 * Insère ou met à jour les items de base. Idempotent : peut être rejoué à chaque démarrage.
 * Ne touche qu'à `items` (jamais aux `user_items` ni aux `review_logs`). Retourne le nombre d'items traités.
 */
export async function seedItems(dataSource: DataSource): Promise<number> {
  const seeds = buildKanaSeeds();
  await dataSource
    .createQueryBuilder()
    .insert()
    .into(Item)
    .values(seeds)
    .orUpdate(['readings', 'meanings', 'sort_order'], ['type', 'character'])
    .execute();
  return seeds.length;
}
