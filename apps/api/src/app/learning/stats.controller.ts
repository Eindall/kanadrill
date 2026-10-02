import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LeaderboardDto, StatsDto, StatsOverviewDto } from '@kanadrill/shared';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { LeaderboardService } from './leaderboard.service';
import { StatsQueryDto } from './stats-query.dto';
import { StatsService } from './stats.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class StatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly leaderboard: LeaderboardService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private async goalOf(userId: string): Promise<number> {
    return (await this.users.findOneByOrFail({ id: userId })).dailyGoal;
  }

  /** La série et les 7 derniers jours (accueil). */
  @Get('stats/overview')
  async overview(@CurrentUserId() userId: string): Promise<StatsOverviewDto> {
    return this.stats.overview(userId, await this.goalOf(userId));
  }

  @Get('stats')
  async detail(@CurrentUserId() userId: string, @Query() query: StatsQueryDto): Promise<StatsDto> {
    return this.stats.stats(userId, await this.goalOf(userId), query);
  }

  @Get('leaderboard')
  board(@CurrentUserId() userId: string): Promise<LeaderboardDto> {
    return this.leaderboard.leaderboard(userId);
  }
}
