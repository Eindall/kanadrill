import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LEADERBOARD_SIZE, type LeaderboardDto, type LeaderboardEntryDto } from '@kanadrill/shared';
import { DEFAULT_TIMEZONE } from '../config/env';
import { StatsService } from './stats.service';

interface StreakRow {
  id: string;
  username: string;
  avatar_url: string | null;
  visible: boolean;
  current: number;
  longest: number;
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
}
