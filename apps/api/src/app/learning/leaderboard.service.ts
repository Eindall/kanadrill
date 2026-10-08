import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  LEADERBOARD_SIZE,
  drawingPoints,
  type LeaderboardDto,
  type LeaderboardEntryDto,
  type WeeklyEntryDto,
  type WeeklyLeaderboardDto,
  type WeeklyMetric,
} from '@kanadrill/shared';
import { DEFAULT_TIMEZONE } from '../config/env';
import { shiftDay, StatsService } from './stats.service';
import { mondayOf } from './weekly-kanji.service';

interface StreakRow {
  id: string;
  username: string;
  avatar_url: string | null;
  visible: boolean;
  current: number;
  longest: number;
}

interface WeeklyRow {
  id: string;
  username: string;
  avatar_url: string | null;
  visible: boolean;
  value: number;
  detail: number;
}

/**
 * Le classement des séries de jours d'apprentissage. N'y figurent que les utilisateurs qui l'acceptent
 * (`users.leaderboard_visible`) et ont une série en cours ; chacun voit toujours sa propre ligne.
 */
@Injectable()
export class LeaderboardService {
  private readonly timezone: string;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stats: StatsService,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('APP_TIMEZONE') || DEFAULT_TIMEZONE;
  }

  async leaderboard(userId: string, now = new Date()): Promise<LeaderboardDto> {
    const today = await this.stats.today(now);
    // Même calcul de série que `StatsService.streak`, pour tous les utilisateurs d'un coup.
    const rows: StreakRow[] = await this.dataSource.query(
      `WITH days AS (
         SELECT DISTINCT user_id, (reviewed_at AT TIME ZONE $1)::date AS day FROM review_logs
       ), grouped AS (
         SELECT user_id, day, day - (row_number() OVER (PARTITION BY user_id ORDER BY day))::int AS grp FROM days
       ), islands AS (
         SELECT user_id, count(*)::int AS length, max(day) AS last_day FROM grouped GROUP BY user_id, grp
       ), streaks AS (
         SELECT user_id, max(length) AS longest, coalesce(max(length) FILTER (WHERE last_day >= $2::date - 1), 0) AS current
         FROM islands GROUP BY user_id
       )
       SELECT u.id, u.username, u.avatar_url, u.leaderboard_visible AS visible,
              coalesce(s.current, 0)::int AS current, coalesce(s.longest, 0)::int AS longest
       FROM users u LEFT JOIN streaks s ON s.user_id = u.id`,
      [this.timezone, today],
    );

    const ranked = rows
      .filter((row) => row.visible && row.current > 0)
      .sort((a, b) => b.current - a.current || b.longest - a.longest || a.username.localeCompare(b.username, 'fr'));
    // Classement « à la compétition » : à égalité de série (en cours et record), on partage le rang (1, 1, 3…).
    const rankOf = new Map<string, number>();
    ranked.forEach((row, index) => {
      const previous = ranked[index - 1];
      const tied = previous && previous.current === row.current && previous.longest === row.longest;
      rankOf.set(row.id, tied ? (rankOf.get(previous.id) as number) : index + 1);
    });

    const entries = ranked.slice(0, LEADERBOARD_SIZE).map(
      (row): LeaderboardEntryDto => ({
        rank: rankOf.get(row.id) as number,
        username: row.username,
        avatarUrl: row.avatar_url,
        currentStreak: row.current,
        longestStreak: row.longest,
        isMe: row.id === userId,
      }),
    );
    const mine = rows.find((row) => row.id === userId);
    return {
      entries,
      me: {
        rank: rankOf.get(userId) ?? null,
        currentStreak: mine?.current ?? 0,
        longestStreak: mine?.longest ?? 0,
        visible: mine?.visible ?? true,
      },
      total: ranked.length,
    };
  }

  /**
   * Classement de la semaine en cours (du lundi au lundi, dans `APP_TIMEZONE`) :
   * - `answers` : réponses données, réussies ou non ; `detail` = taux de réussite (note ≥ Hard) en %.
   * - `points` : **points** de toutes les bonnes réponses (`review_logs.points`, calculés à l'enregistrement : 80 en chill,
   *   120 → 60 selon le temps en chronométré, précision × bonus au tracé) ; `detail` = nombre de bonnes réponses.
   * - `drawing` : **points de tracé** = somme, sur les tracés comptés réussis (note ≥ Hard : un tracé « raté » vaut 0),
   *   de la précision recalculée par le serveur, × un bonus de rapidité (jusqu'à ×1,2, voir `speedBonus`) en mode
   *   chronométré seulement ;
   *   `detail` = nombre de tracés faits. Les tracés sans précision (anciens ou envoyés sans dessin) ne comptent pas.
   * Même règle de visibilité que les séries : seuls les utilisateurs visibles et à plus de 0 point sont classés.
   */
  async weekly(userId: string, metric: WeeklyMetric, now = new Date()): Promise<WeeklyLeaderboardDto> {
    const weekStart = mondayOf(await this.stats.today(now));
    const nextWeekStart = shiftDay(weekStart, 7);
    const rows =
      metric === 'answers'
        ? await this.answerRows(weekStart, nextWeekStart)
        : metric === 'points'
          ? await this.pointRows(weekStart, nextWeekStart)
          : await this.drawingRows(weekStart, nextWeekStart);

    const ranked = rows
      .filter((row) => row.visible && row.value > 0)
      .sort((a, b) => b.value - a.value || a.username.localeCompare(b.username, 'fr'));
    // Rang « à la compétition » : à égalité de points on partage le rang (1, 1, 3…).
    const rankOf = new Map<string, number>();
    ranked.forEach((row, index) => {
      const previous = ranked[index - 1];
      rankOf.set(row.id, previous && previous.value === row.value ? (rankOf.get(previous.id) as number) : index + 1);
    });

    const entries = ranked.slice(0, LEADERBOARD_SIZE).map(
      (row): WeeklyEntryDto => ({
        rank: rankOf.get(row.id) as number,
        username: row.username,
        avatarUrl: row.avatar_url,
        value: row.value,
        detail: row.detail,
        isMe: row.id === userId,
      }),
    );
    const mine = rows.find((row) => row.id === userId);
    return {
      metric,
      weekStart,
      nextWeekStart,
      entries,
      me: { rank: rankOf.get(userId) ?? null, value: mine?.value ?? 0, detail: mine?.detail ?? 0, visible: mine?.visible ?? true },
      total: ranked.length,
    };
  }

  /** Début et fin de la semaine, en instants (minuit du lundi dans `APP_TIMEZONE`). */
  private static readonly WINDOW = `r.reviewed_at >= ($1::date::timestamp AT TIME ZONE $3) AND r.reviewed_at < ($2::date::timestamp AT TIME ZONE $3)`;

  private answerRows(weekStart: string, nextWeekStart: string): Promise<WeeklyRow[]> {
    return this.dataSource.query(
      `SELECT u.id, u.username, u.avatar_url, u.leaderboard_visible AS visible,
              count(r.id)::int AS value,
              coalesce(round(100.0 * count(r.id) FILTER (WHERE r.rating >= 2) / nullif(count(r.id), 0)), 0)::int AS detail
       FROM users u
       LEFT JOIN review_logs r ON r.user_id = u.id AND ${LeaderboardService.WINDOW}
       GROUP BY u.id`,
      [weekStart, nextWeekStart, this.timezone],
    );
  }

  private pointRows(weekStart: string, nextWeekStart: string): Promise<WeeklyRow[]> {
    return this.dataSource.query(
      `SELECT u.id, u.username, u.avatar_url, u.leaderboard_visible AS visible,
              coalesce(sum(r.points), 0)::int AS value,
              count(r.id) FILTER (WHERE r.points > 0)::int AS detail
       FROM users u
       LEFT JOIN review_logs r ON r.user_id = u.id AND ${LeaderboardService.WINDOW}
       GROUP BY u.id`,
      [weekStart, nextWeekStart, this.timezone],
    );
  }

  /**
   * Points de tracé : par tracé compté réussi (note ≥ Hard), la précision, × le bonus de rapidité (`drawingPoints`,
   * d'après la durée et le nombre de traits du modèle) si le tracé était chronométré ; un tracé raté vaut 0. Calculés ici plutôt qu'en SQL pour que la formule
   * reste une fonction partagée et testée ; on ne lit que les tracés de la semaine.
   */
  private async drawingRows(weekStart: string, nextWeekStart: string): Promise<WeeklyRow[]> {
    const users: Array<Omit<WeeklyRow, 'value' | 'detail'>> = await this.dataSource.query(
      `SELECT id, username, avatar_url, leaderboard_visible AS visible FROM users`,
    );
    const drawings: Array<{ user_id: string; rating: number; precision: number; duration_ms: number; timed: boolean; strokes: number | null }> =
      await this.dataSource.query(
        `SELECT r.user_id, r.rating, r.drawing_precision AS precision, r.duration_ms, r.timed,
                jsonb_array_length(i.metadata -> 'strokes') AS strokes
         FROM review_logs r JOIN items i ON i.id = r.item_id
         WHERE r.drawing_precision IS NOT NULL AND ${LeaderboardService.WINDOW}`,
        [weekStart, nextWeekStart, this.timezone],
      );
    const totals = new Map<string, { points: number; count: number }>();
    for (const row of drawings) {
      const total = totals.get(row.user_id) ?? { points: 0, count: 0 };
      total.count++;
      if (row.rating >= 2) {
        // Le bonus de rapidité est réservé au mode chronométré ; en mode chill, la précision seule.
        total.points += row.timed ? drawingPoints(row.precision, row.duration_ms, row.strokes ?? 1) : row.precision;
      }
      totals.set(row.user_id, total);
    }
    return users.map((user) => {
      const total = totals.get(user.id);
      return { ...user, value: Math.round(total?.points ?? 0), detail: total?.count ?? 0 };
    });
  }
}
