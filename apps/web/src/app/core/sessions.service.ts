import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { SessionInfoDto } from '@kanadrill/shared';
import { firstValueFrom } from 'rxjs';

/** Appareils connectés de l'utilisateur. */
@Injectable({ providedIn: 'root' })
export class SessionsService {
  private readonly http = inject(HttpClient);

  list(): Promise<SessionInfoDto[]> {
    return firstValueFrom(this.http.get<SessionInfoDto[]>('/api/users/me/sessions'));
  }

  revoke(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/users/me/sessions/${encodeURIComponent(id)}`));
  }

  revokeOthers(): Promise<void> {
    return firstValueFrom(this.http.delete<void>('/api/users/me/sessions'));
  }
}
