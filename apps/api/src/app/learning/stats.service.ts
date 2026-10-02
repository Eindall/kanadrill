import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  DEFAULT_STATS_PERIOD,
  FORECAST_DAYS,
  KANA_TYPES,
  MAX_STATS_RANGE_DAYS,
  WEAKEST_COUNT,
  type CardState,
  type DayActivityDto,
  type ForecastDayDto,
  type IsoDay,
  type ItemType,
  type KanjiLevel,
  type MasteryCounts,
  type MasteryStatsDto,
  type StatsDto,
  type StatsOverviewDto,
  type StreakDto,
  type WeakItemDto,
} from '@kanadrill/shared';
import { DEFAULT_TIMEZONE } from '../config/env';
import { masteryLevel } from './mastery';
import type { StatsQueryDto } from './stats-query.dto';

const emptyCounts = (): MasteryCounts => ({ unseen: 0, learning: 0, known: 0, mastered: 0 });

/** `AAAA-MM-JJ` réellement existant (pas de 31 février) ? */
function isRealDay(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

/** Décale un jour de `delta` jours (calcul en UTC : un jour calendaire est un jour, quel que soit le fuseau). */
export function shiftDay(day: IsoDay, delta: number): IsoDay {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const daysBetween = (from: IsoDay, to: IsoDay): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Statistiques d'un utilisateur. Les « jours » suivent `APP_TIMEZONE` (comme l'objectif quotidien) : une réponse
 * donnée à 23 h 50 compte pour la veille de minuit, quel que soit le fuseau du serveur ou de l'appareil.
 */
@Injectable()
export class StatsService {
  private readonly timezone: string;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('APP_TIMEZONE') || DEFAULT_TIMEZONE;
  }

  /** Aujourd'hui dans le fuseau de l'application. */
  async today(now = new Date()): Promise<IsoDay> {
    const [row] = await this.dataSource.query(`SELECT to_char(($1::timestamptz AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS today`, [
      now,
      this.timezone,
    ]);
    return row.today;
  }

  /**
   * Série en cours et plus longue série. Une série est une suite de jours consécutifs avec au moins une réponse
   * (technique des « îlots » : jour − rang = constante au sein d'une suite). La série en cours est celle qui se
   * termine aujourd'hui ou hier.
   */
  async streak(userId: string, today: IsoDay): Promise<StreakDto> {
    const [row] = await this.dataSource.query(
      `WITH days AS (
         SELECT DISTINCT (reviewed_at AT TIME ZONE $2)::date AS day FROM review_logs WHERE user_id = $1
       ), grouped AS (
         SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp FROM days
       ), islands AS (
         SELECT count(*)::int AS length, max(day) AS last_day FROM grouped GROUP BY grp
       )
       SELECT coalesce(max(length), 0)::int AS longest,
              coalesce(max(length) FILTER (WHERE last_day >= $3::date - 1), 0)::int AS current,
              coalesce(bool_or(last_day = $3::date), false) AS active_today
       FROM islands`,
      [userId, this.timezone, today],
    );
    return { current: row.current, longest: row.longest, activeToday: row.active_today };
  }

  /** La série et les 7 derniers jours : ce que l'accueil affiche. */
  async overview(userId: string, goal: number, now = new Date()): Promise<StatsOverviewDto> {
    const today = await this.today(now);
    const [streak, recent] = await Promise.all([this.streak(userId, today), this.activity(userId, shiftDay(today, -6), today)]);
    return { today, dailyGoal: goal, streak, recent };
  }

  /** Réponses de chaque jour de la plage (les jours sans réponse y figurent, à zéro). */
  async activity(userId: string, from: IsoDay, to: IsoDay): Promise<DayActivityDto[]> {
    const rows: Array<{ date: string; answers: number; correct: number }> = await this.dataSource.query(
      `SELECT to_char($2::date + i, 'YYYY-MM-DD') AS date, coalesce(a.answers, 0)::int AS answers, coalesce(a.correct, 0)::int AS correct
       FROM generate_series(0, $3::date - $2::date) AS i
       LEFT JOIN (
         SELECT (reviewed_at AT TIME ZONE $4)::date AS day, count(*) AS answers, count(*) FILTER (WHERE rating >= 2) AS correct
         FROM review_logs
         WHERE user_id = $1
           AND reviewed_at >= ($2::date)::timestamp AT TIME ZONE $4
           AND reviewed_at < ($3::date + 1)::timestamp AT TIME ZONE $4
         GROUP BY 1
       ) a ON a.day = $2::date + i
       ORDER BY i`,
      [userId, from, to, this.timezone],
    );
    return rows;
  }

  async stats(userId: string, goal: number, query: StatsQueryDto, now = new Date()): Promise<StatsDto> {
    const today = await this.today(now);
    const { from, to } = this.resolveRange(query, today);

    const [days, streak, mastery, weakest, forecast, distinct] = await Promise.all([
      this.activity(userId, from, to),
      this.streak(userId, today),
      this.mastery(userId),
      this.weakest(userId, from, to),
      this.forecast(userId, today),
      this.distinctItems(userId, from, to),
    ]);

    return {
      from,
      to,
      today,
      dailyGoal: goal,
      days,
      totals: {
        answers: days.reduce((sum, day) => sum + day.answers, 0),
        correct: days.reduce((sum, day) => sum + day.correct, 0),
        activeDays: days.filter((day) => day.answers > 0).length,
        distinctItems: distinct,
      },
      streak,
      mastery,
      weakest,
      forecast,
    };
  }

  /** La plage demandée, validée : `days` jusqu'à aujourd'hui, ou `from`/`to` (borné à aujourd'hui). */
  private resolveRange(query: StatsQueryDto, today: IsoDay): { from: IsoDay; to: IsoDay } {
    if (query.from === undefined) {
      if (query.to !== undefined) throw new BadRequestException('`to` demande aussi `from`.');
      return { from: shiftDay(today, -((query.days ?? DEFAULT_STATS_PERIOD) - 1)), to: today };
    }
    if (query.days !== undefined) throw new BadRequestException('Choisis `days` ou `from`, pas les deux.');
    if (!isRealDay(query.from) || (query.to !== undefined && !isRealDay(query.to))) {
      throw new BadRequestException("Cette date n'existe pas.");
    }
    const to = query.to !== undefined && query.to < today ? query.to : today;
    if (query.from > to) throw new BadRequestException('La date de début doit précéder la date de fin.');
    if (daysBetween(query.from, to) + 1 > MAX_STATS_RANGE_DAYS) {
      throw new BadRequestException(`La période ne peut pas dépasser ${MAX_STATS_RANGE_DAYS} jours.`);
    }
    return { from: query.from, to };
  }

  private async distinctItems(userId: string, from: IsoDay, to: IsoDay): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT count(DISTINCT item_id)::int AS count FROM review_logs
       WHERE user_id = $1 AND reviewed_at >= ($2::date)::timestamp AT TIME ZONE $4 AND reviewed_at < ($3::date + 1)::timestamp AT TIME ZONE $4`,
      [userId, from, to, this.timezone],
    );
    return row.count;
  }

  /** Maîtrise actuelle : tous les kana, et les kanji du dictionnaire par niveau JLPT. */
  private async mastery(userId: string): Promise<MasteryStatsDto> {
    const [totals, cards]: [Array<{ type: ItemType; count: number }>, Array<{ type: ItemType; level: KanjiLevel; state: CardState; reps: number; stability: number }>] =
      await Promise.all([
        this.dataSource.query(`SELECT type, count(*)::int AS count FROM items WHERE type = ANY($1) GROUP BY type`, [KANA_TYPES]),
        this.dataSource.query(
          `SELECT i.type, coalesce(i.metadata ->> 'jlpt', 'other') AS level, ui.state, ui.reps, ui.stability
           FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1`,
          [userId],
        ),
      ]);

    const mastery: MasteryStatsDto = { hiragana: emptyCounts(), katakana: emptyCounts(), kanji: {} };
    for (const card of cards) {
      const level = masteryLevel(card);
      if (card.type === 'kanji') (mastery.kanji[card.level] ??= emptyCounts())[level]++;
      else if (card.type === 'hiragana' || card.type === 'katakana') mastery[card.type][level]++;
    }
    // Un kana sans carte n'a jamais reçu de réponse : il est « jamais vu » (les cartes neuves y sont déjà comptées).
    for (const type of ['hiragana', 'katakana'] as const) {
      const total = totals.find((row) => row.type === type)?.count ?? 0;
      const known = mastery[type].learning + mastery[type].known + mastery[type].mastered;
      mastery[type].unseen = Math.max(0, total - known);
    }
    return mastery;
  }

  private async weakest(userId: string, from: IsoDay, to: IsoDay): Promise<WeakItemDto[]> {
    const rows: Array<{ id: string; type: ItemType; character: string; readings: string[]; meanings: string[]; answers: number; misses: number }> =
      await this.dataSource.query(
        `SELECT i.id, i.type, i.character, i.readings, i.meanings, count(*)::int AS answers, (count(*) FILTER (WHERE l.rating = 1))::int AS misses
         FROM review_logs l JOIN items i ON i.id = l.item_id
         WHERE l.user_id = $1 AND l.reviewed_at >= ($2::date)::timestamp AT TIME ZONE $4 AND l.reviewed_at < ($3::date + 1)::timestamp AT TIME ZONE $4
         GROUP BY i.id HAVING count(*) FILTER (WHERE l.rating = 1) > 0
         ORDER BY misses DESC, (count(*) FILTER (WHERE l.rating = 1))::float / count(*) DESC, i.sort_order
         LIMIT ${WEAKEST_COUNT}`,
        [userId, from, to, this.timezone],
      );
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      character: row.character,
      label: row.type === 'kanji' ? (row.meanings[0] ?? '') : (row.readings[0] ?? ''),
      answers: row.answers,
      misses: row.misses,
    }));
  }

  /** Cartes à revoir (déjà vues) par jour sur les `FORECAST_DAYS` prochains jours ; les cartes en retard comptent aujourd'hui. */
  private async forecast(userId: string, today: IsoDay): Promise<ForecastDayDto[]> {
    const rows: Array<{ date: string; due: number }> = await this.dataSource.query(
      `SELECT to_char(GREATEST((due AT TIME ZONE $2)::date, $3::date), 'YYYY-MM-DD') AS date, count(*)::int AS due
       FROM user_items WHERE user_id = $1 AND state <> 0 AND (due AT TIME ZONE $2)::date < $3::date + ${FORECAST_DAYS}
       GROUP BY 1`,
      [userId, this.timezone, today],
    );
    return Array.from({ length: FORECAST_DAYS }, (_, i) => {
      const date = shiftDay(today, i);
      return { date, due: rows.find((row) => row.date === date)?.due ?? 0 };
    });
  }
}
