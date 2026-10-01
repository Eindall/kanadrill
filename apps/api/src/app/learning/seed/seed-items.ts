import { DataSource } from 'typeorm';
import type { ItemType } from '@kanadrill/shared';
import { Item } from '../item.entity';
import { HIRAGANA_ENTRIES, toKatakana } from './kana.data';

interface ItemSeed {
  type: ItemType;
  character: string;
  readings: string[];
  meanings: string[];
}

export function buildKanaSeeds(): ItemSeed[] {
  return HIRAGANA_ENTRIES.flatMap(([hiragana, readings]) => [
    { type: 'hiragana' as const, character: hiragana, readings: [...readings], meanings: [] },
    { type: 'katakana' as const, character: toKatakana(hiragana), readings: [...readings], meanings: [] },
  ]);
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
    .orUpdate(['readings', 'meanings'], ['type', 'character'])
    .execute();
  return seeds.length;
}
