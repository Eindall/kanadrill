import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KANJI_LEVELS, type JlptLevel, type WeeklyKanjiDto } from '@kanadrill/shared';
import { shiftDay, StatsService } from './stats.service';

/** Les premiers sens affichés dans la suggestion (KANJIDIC2 en donne parfois beaucoup). */
const MEANINGS_SHOWN = 3;
/** Lectures affichées par famille (on, kun). */
const READINGS_SHOWN = 3;

/** Le lundi (inclus) de la semaine du jour donné. */
export function mondayOf(day: string): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
  return shiftDay(day, -weekday);
}

/**
 * Le « kanji de la semaine » : un kanji **au hasard parmi ceux qu'il reste à ajouter dans le niveau JLPT le plus bas**
 * où il en reste (N5, puis N4… N1, puis les « autres »). Il est tiré à la première visite de la semaine puis gardé
 * jusqu'au lundi suivant (dans `APP_TIMEZONE`), même s'il est ajouté au dictionnaire entre-temps. Dans ce niveau, le
 * kanji de la semaine précédente passe en dernier : il n'est reproposé que s'il est le seul restant du niveau (on ne
 * saute pas au niveau suivant pour l'éviter).
 */
@Injectable()
export class WeeklyKanjiService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stats: StatsService,
  ) {}

  async current(userId: string, now = new Date()): Promise<WeeklyKanjiDto | null> {
    const weekStart = mondayOf(await this.stats.today(now));
    let itemId = await this.stored(userId, weekStart);
    if (!itemId) {
      const previous = await this.stored(userId, shiftDay(weekStart, -7));
      const picked = await this.pick(userId, previous);
      if (!picked) return null; // tous les kanji sont dans le dictionnaire
      // Deux appels simultanés peuvent tirer chacun un kanji : la contrainte d'unicité en garde un seul, que tous relisent.
      await this.dataSource.query(
        `INSERT INTO weekly_kanji (user_id, item_id, week_start) VALUES ($1, $2, $3) ON CONFLICT (user_id, week_start) DO NOTHING`,
        [userId, picked, weekStart],
      );
      itemId = (await this.stored(userId, weekStart)) as string;
    }
    return this.describe(userId, itemId, weekStart);
  }

  private async stored(userId: string, weekStart: string): Promise<string | null> {
    const rows: Array<{ item_id: string }> = await this.dataSource.query(
      `SELECT item_id FROM weekly_kanji WHERE user_id = $1 AND week_start = $2`,
      [userId, weekStart],
    );
    return rows[0]?.item_id ?? null;
  }

  /** Un kanji au hasard parmi les restants du niveau le plus bas (`avoided` en dernier recours), ou `null`. */
  private async pick(userId: string, avoided: string | null): Promise<string | null> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT i.id FROM items i
       WHERE i.type = 'kanji'
         AND NOT EXISTS (SELECT 1 FROM user_items ui WHERE ui.item_id = i.id AND ui.user_id = $1)
       ORDER BY array_position($3::text[], coalesce(i.metadata ->> 'jlpt', 'other')), coalesce(i.id = $2::uuid, false), random()
       LIMIT 1`,
      [userId, avoided, KANJI_LEVELS as readonly string[]],
    );
    return rows[0]?.id ?? null;
  }

  private async describe(userId: string, itemId: string, weekStart: string): Promise<WeeklyKanjiDto> {
    const [row]: Array<{
      id: string;
      character: string;
      meanings: string[];
      on: string[] | null;
      kun: string[] | null;
      jlpt: JlptLevel | null;
      in_dictionary: boolean;
    }> = await this.dataSource.query(
      `SELECT i.id, i.character, i.meanings, i.metadata -> 'on' AS "on", i.metadata -> 'kun' AS kun, i.metadata ->> 'jlpt' AS jlpt,
              EXISTS (SELECT 1 FROM user_items ui WHERE ui.item_id = i.id AND ui.user_id = $2) AS in_dictionary
       FROM items i WHERE i.id = $1`,
      [itemId, userId],
    );
    return {
      id: row.id,
      character: row.character,
      meanings: row.meanings.slice(0, MEANINGS_SHOWN),
      on: (row.on ?? []).slice(0, READINGS_SHOWN),
      kun: (row.kun ?? []).slice(0, READINGS_SHOWN),
      jlpt: row.jlpt,
      inDictionary: row.in_dictionary,
      weekStart,
      nextChange: shiftDay(weekStart, 7),
    };
  }
}
