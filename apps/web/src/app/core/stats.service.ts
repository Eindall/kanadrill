import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { LeaderboardDto, StatsDto, StatsOverviewDto } from '@kanadrill/shared';
import { firstValueFrom } from 'rxjs';

/** Période demandée : un nombre de jours jusqu'à aujourd'hui, ou une plage de dates (`to` : aujourd'hui par défaut). */
export type StatsRange = { days: number } | { from: string; to?: string };

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);

  loadOverview(): Promise<StatsOverviewDto> {
    return firstValueFrom(this.http.get<StatsOverviewDto>('/api/stats/overview'));
  }

  loadStats(range: StatsRange): Promise<StatsDto> {
    let params = new HttpParams();
    if ('days' in range) params = params.set('days', range.days);
    else {
      params = params.set('from', range.from);
      if (range.to) params = params.set('to', range.to);
    }
    return firstValueFrom(this.http.get<StatsDto>('/api/stats', { params }));
  }

  loadLeaderboard(): Promise<LeaderboardDto> {
    return firstValueFrom(this.http.get<LeaderboardDto>('/api/leaderboard'));
  }
}
