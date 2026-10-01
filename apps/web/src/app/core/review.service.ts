import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ReviewResultDto, ReviewSessionDto, SubmitReviewRequest } from '@kanadrill/shared';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);

  loadSession(): Promise<ReviewSessionDto> {
    return firstValueFrom(this.http.get<ReviewSessionDto>('/api/reviews/session'));
  }

  submit(request: SubmitReviewRequest): Promise<ReviewResultDto> {
    return firstValueFrom(this.http.post<ReviewResultDto>('/api/reviews', request));
  }
}
