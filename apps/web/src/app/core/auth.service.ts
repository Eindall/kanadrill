import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { UpdateProfileRequest, UserDto } from '@kanadrill/shared';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** Utilisateur connecté, ou null. */
  readonly user = signal<UserDto | null>(null);
  private loaded = false;

  /** Charge la session une seule fois (au premier passage d'un guard). */
  async ensureLoaded(): Promise<UserDto | null> {
    if (!this.loaded) {
      await this.refresh();
    }
    return this.user();
  }

  async refresh(): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.http.get<UserDto>('/api/users/me')));
    } catch (error) {
      // 401 = pas connecté ; toute autre erreur (API injoignable) est traitée pareil côté UI.
      if (!(error instanceof HttpErrorResponse)) throw error;
      this.user.set(null);
    }
    this.loaded = true;
  }

  async updateUsername(username: string): Promise<void> {
    const body: UpdateProfileRequest = { username };
    this.user.set(await firstValueFrom(this.http.patch<UserDto>('/api/users/me', body)));
  }

  async updateDailyGoal(dailyGoal: number): Promise<void> {
    const body: UpdateProfileRequest = { dailyGoal };
    this.user.set(await firstValueFrom(this.http.patch<UserDto>('/api/users/me', body)));
  }

  /** Oublie l'utilisateur côté front (session expirée ou révoquée : le serveur a déjà répondu 401). */
  clearUser(): void {
    this.user.set(null);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post<void>('/api/auth/logout', {}));
    this.user.set(null);
  }

  async deleteAccount(): Promise<void> {
    await firstValueFrom(this.http.delete<void>('/api/users/me'));
    this.user.set(null);
  }
}
