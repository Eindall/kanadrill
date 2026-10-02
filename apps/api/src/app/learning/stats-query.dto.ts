import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches } from 'class-validator';
import { STATS_PERIODS } from '@kanadrill/shared';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Paramètres de `GET /stats` : soit `days` (jusqu'à aujourd'hui), soit `from` (et `to`, aujourd'hui par défaut). */
export class StatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(STATS_PERIODS)
  days?: number;

  @IsOptional()
  @Matches(DAY, { message: 'from doit être une date AAAA-MM-JJ' })
  from?: string;

  @IsOptional()
  @Matches(DAY, { message: 'to doit être une date AAAA-MM-JJ' })
  to?: string;
}
