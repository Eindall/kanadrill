import { IsIn } from 'class-validator';
import { WEEKLY_METRICS, type WeeklyMetric } from '@kanadrill/shared';

/** Paramètre de `GET /leaderboard/weekly`. */
export class WeeklyLeaderboardQueryDto {
  @IsIn(WEEKLY_METRICS)
  metric!: WeeklyMetric;
}
