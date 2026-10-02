import { DataSource } from 'typeorm';
import { KANA_GROUPS, KANA_GROUP_ENTRIES, toKatakana, type ItemType, type KanaEntry, type KanaGroup, type StrokeDto } from '@kanadrill/shared';
import { kanaStrokes } from './kana-strokes';
import { buildKanjiSeeds } from './kanji-seed';

export interface ItemSeed<Metadata = Record<string, unknown>> {
  type: ItemType;
  character: string;
  readings: string[];
  meanings: string[];
  sortOrder: number;
  /** Kana : `group` et `strokes`. Kanji : niveau, lectures, tracés… (voir `kanji-seed.ts`). */
  metadata: Metadata;
}

export type KanaMetadata = { group: KanaGroup; strokes: StrokeDto[] };

/** Les katakana viennent après tous les hiragana (jeu de 104 kana + marge). */
const KATAKANA_OFFSET = 1000;

export function buildKanaSeeds(): Array<ItemSeed<KanaMetadata>> {
  // Ordre d'introduction : tout le hiragana, puis tout le katakana, chacun dans l'ordre de la table.
  const entries = KANA_GROUPS.flatMap((group) =>
    KANA_GROUP_ENTRIES[group].map((entry): [KanaGroup, KanaEntry] => [group, entry]),
  );
  const hiragana = entries.map(([group, [character, readings]], index): ItemSeed<KanaMetadata> => ({
    type: 'hiragana',
    character,
    readings: [...readings],
    meanings: [],
    sortOrder: index,
    metadata: { group, strokes: kanaStrokes(character) },
  }));
  const katakana = entries.map(([group, [hiraganaCharacter, readings]], index): ItemSeed<KanaMetadata> => {
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

const CHUNK_SIZE = 250;

/**
 * Insère ou met à jour des items (par lots). N'écrit que les lignes qui ont changé (`IS DISTINCT FROM`) : relancé
 * à chaque démarrage sur les mêmes données, il ne réécrit rien, ce qui compte avec les 10 000 kanji et leurs tracés.
 */
export async function upsertItems(dataSource: DataSource, seeds: readonly ItemSeed[]): Promise<void> {
  for (let start = 0; start < seeds.length; start += CHUNK_SIZE) {
    const chunk = seeds.slice(start, start + CHUNK_SIZE);
    const params: unknown[] = [];
    const rows = chunk.map((seed) => {
      const base = params.length;
      params.push(seed.type, seed.character, seed.readings, seed.meanings, seed.sortOrder, JSON.stringify(seed.metadata));
      return `($${base + 1}, $${base + 2}, $${base + 3}::text[], $${base + 4}::text[], $${base + 5}, $${base + 6}::jsonb)`;
    });
    await dataSource.query(
      `INSERT INTO items (type, character, readings, meanings, sort_order, metadata)
       VALUES ${rows.join(', ')}
       ON CONFLICT (type, character) DO UPDATE SET
         readings = EXCLUDED.readings, meanings = EXCLUDED.meanings,
         sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata
       WHERE (items.readings, items.meanings, items.sort_order, items.metadata)
         IS DISTINCT FROM (EXCLUDED.readings, EXCLUDED.meanings, EXCLUDED.sort_order, EXCLUDED.metadata)`,
      params,
    );
  }
}

/**
 * Synchronise les items de base : les kana, puis les kanji (`assets/kanji.json.gz`). Idempotent : peut être rejoué
 * à chaque démarrage. Ne touche qu'à `items` (jamais aux `user_items` ni aux `review_logs`). Retourne les effectifs.
 */
export async function seedItems(dataSource: DataSource): Promise<{ kana: number; kanji: number }> {
  const kana = buildKanaSeeds();
  await upsertItems(dataSource, kana);
  const kanji = buildKanjiSeeds();
  await upsertItems(dataSource, kanji);
  return { kana: kana.length, kanji: kanji.length };
}
