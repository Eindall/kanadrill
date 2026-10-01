import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ReviewOverviewDto,
  ReviewResultDto,
  ReviewSessionDto,
  SessionConfig,
  SubmitReviewRequest,
} from '@kanadrill/shared';
import { firstValueFrom } from 'rxjs';
import { configToParams } from '../features/review/session-config';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);

  loadSession(config: SessionConfig): Promise<ReviewSessionDto> {
    return firstValueFrom(this.http.get<ReviewSessionDto>('/api/reviews/session', { params: configToParams(config) }));
  }

  loadOverview(): Promise<ReviewOverviewDto> {
    return firstValueFrom(this.http.get<ReviewOverviewDto>('/api/reviews/overview'));
  }

  submit(request: SubmitReviewRequest): Promise<ReviewResultDto> {
    return firstValueFrom(this.http.post<ReviewResultDto>('/api/reviews', request));
  }
}
