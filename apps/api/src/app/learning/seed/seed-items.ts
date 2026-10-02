import { DataSource } from 'typeorm';
import { KANA_GROUPS, type ItemType, type KanaGroup, type StrokeDto } from '@kanadrill/shared';
import { Item } from '../item.entity';
import { KANA_GROUP_ENTRIES, toKatakana, type KanaEntry } from './kana.data';
import { kanaStrokes } from './kana-strokes';

interface ItemSeed {
  type: ItemType;
  character: string;
  readings: string[];
  meanings: string[];
  sortOrder: number;
  /** `group` (kana) et `strokes` (ordre des traits, KanjiVG). */
  metadata: { group: KanaGroup; strokes: StrokeDto[] };
}

/** Les katakana viennent après tous les hiragana (jeu de 104 kana + marge). */
const KATAKANA_OFFSET = 1000;

export function buildKanaSeeds(): ItemSeed[] {
  // Ordre d'introduction : tout le hiragana, puis tout le katakana, chacun dans l'ordre de la table.
  const entries = KANA_GROUPS.flatMap((group) =>
    KANA_GROUP_ENTRIES[group].map((entry): [KanaGroup, KanaEntry] => [group, entry]),
  );
  const hiragana = entries.map(([group, [character, readings]], index): ItemSeed => ({
    type: 'hiragana',
    character,
    readings: [...readings],
    meanings: [],
    sortOrder: index,
    metadata: { group, strokes: kanaStrokes(character) },
  }));
  const katakana = entries.map(([group, [hiraganaCharacter, readings]], index): ItemSeed => {
    const character = toKatakana(hiraganaCharacter);
    return {
      type: 'katakana',
      character,
      readings: [...readings],
      meanings: [],
      sortOrder: KATAKANA_OFFSET + index,
      metadata: { group, strokes: kanaStrokes(character) },
    };
  });
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
    .orUpdate(['readings', 'meanings', 'sort_order', 'metadata'], ['type', 'character'])
    .execute();
  return seeds.length;
}
