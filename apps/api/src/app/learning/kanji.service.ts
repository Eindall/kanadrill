import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  KANJI_LEVELS,
  normalizeRomaji,
  type CardState,
  type JlptLevel,
  type KanjiLevel,
  type KanjiLevelSummaryDto,
  type KanjiListItemDto,
  type KanjiPageDto,
} from '@kanadrill/shared';
import { masteryLevel } from './mastery';
import type { KanjiQueryDto } from './kanji-query.dto';

interface KanjiRow {
  id: string;
  character: string;
  meaning: string | null;
  jlpt: JlptLevel | null;
  user_item_id: string | null;
  state: CardState | null;
  reps: number | null;
  stability: number | null;
}

/** Ce qui est un kanji (ou un kana de la même plage CJK) dans une recherche : on cherche alors ces caractères eux-mêmes. */
const HAN = /\p{Script=Han}/u;

/** Échappe les jokers de `ILIKE`. */
const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Le catalogue des kanji (« Apprendre ») : niveaux, recherche, pagination, avec l'état du dictionnaire de l'utilisateur. */
@Injectable()
export class KanjiService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async levels(userId: string): Promise<KanjiLevelSummaryDto[]> {
    const rows: Array<{ level: KanjiLevel; total: string; in_dictionary: string }> = await this.dataSource.query(
      `SELECT coalesce(i.metadata ->> 'jlpt', 'other') AS level, count(*) AS total, count(ui.id) AS in_dictionary
       FROM items i LEFT JOIN user_items ui ON ui.item_id = i.id AND ui.user_id = $1
       WHERE i.type = 'kanji' GROUP BY 1`,
      [userId],
    );
    return KANJI_LEVELS.map((level) => {
      const row = rows.find((candidate) => candidate.level === level);
      return { level, total: Number(row?.total ?? 0), inDictionary: Number(row?.in_dictionary ?? 0) };
    });
  }

  /** Conditions SQL de la recherche ; `first` est le numéro du premier paramètre ($1 pour le décompte, $2 après l'utilisateur). */
  private filter(query: KanjiQueryDto, first: number): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const bind = (value: unknown): string => `$${first - 1 + params.push(value)}`;
    const where: string[] = [`i.type = 'kanji'`];

    if (query.level === 'other') where.push(`i.metadata ->> 'jlpt' IS NULL`);
    else if (query.level) where.push(`i.metadata ->> 'jlpt' = ${bind(query.level)}`);

    const text = query.q?.trim();
    if (text) {
      if (HAN.test(text)) {
        where.push(`i.character = ANY(${bind([...new Set([...text].filter((c) => HAN.test(c)))])})`);
      } else {
        const meaning = bind(`%${escapeLike(text)}%`);
        const romaji = bind(normalizeRomaji(text));
        where.push(`(array_to_string(i.meanings, ' ') ILIKE ${meaning} OR ${romaji} = ANY(i.readings))`);
      }
    }
    return { sql: where.join(' AND '), params };
  }

  async list(userId: string, query: KanjiQueryDto): Promise<KanjiPageDto> {
    const counting = this.filter(query, 1);
    const [{ count }] = await this.dataSource.query(`SELECT count(*) AS count FROM items i WHERE ${counting.sql}`, counting.params);

    const listing = this.filter(query, 2);
    const rows: KanjiRow[] = await this.dataSource.query(
      `SELECT i.id, i.character, i.meanings[1] AS meaning, i.metadata ->> 'jlpt' AS jlpt,
              ui.id AS user_item_id, ui.state, ui.reps, ui.stability
       FROM items i LEFT JOIN user_items ui ON ui.item_id = i.id AND ui.user_id = $1
       WHERE ${listing.sql} ORDER BY i.sort_order LIMIT $${listing.params.length + 2} OFFSET $${listing.params.length + 3}`,
      [userId, ...listing.params, query.limit, query.offset],
    );

    const items = rows.map(
      (row): KanjiListItemDto => ({
        id: row.id,
        character: row.character,
        meaning: row.meaning ?? '',
        jlpt: row.jlpt,
        inDictionary: row.user_item_id !== null,
        mastery: row.user_item_id
          ? masteryLevel({ state: row.state as CardState, reps: row.reps ?? 0, stability: row.stability ?? 0 })
          : 'unseen',
      }),
    );
    return { items, total: Number(count) };
  }
}
