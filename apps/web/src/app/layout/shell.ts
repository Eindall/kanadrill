import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppUpdateService } from '../core/app-update.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="border-b border-line bg-paper">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-6">
          <a routerLink="/" class="text-lg font-semibold tracking-tight">KanaDrill</a>
          <nav aria-label="Navigation principale">
            <a
              routerLink="/learn"
              routerLinkActive="border-ink text-ink"
              ariaCurrentWhenActive="page"
              class="border-b-2 border-transparent py-1 text-ink-soft hover:text-ink"
            >
              Apprendre
            </a>
          </nav>
        </div>

        @if (auth.user(); as user) {
          <a routerLink="/profile" class="flex items-center gap-3" [attr.aria-label]="'Mon profil, ' + user.username">
            <span class="max-w-32 truncate text-sm text-ink-soft max-sm:hidden">{{ user.username }}</span>
            @if (user.avatarUrl) {
              <img [src]="user.avatarUrl" alt="" width="36" height="36" class="size-9 rounded-full bg-snow" />
            } @else {
              <span class="size-9 rounded-full bg-line" aria-hidden="true"></span>
            }
          </a>
        }
      </div>
    </header>

    @if (update.updateReady()) {
      <div role="status" class="bg-ink text-paper">
        <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 text-sm">
          <span>Une nouvelle version de KanaDrill est disponible.</span>
          <button type="button" (click)="update.apply()" class="shrink-0 font-medium underline underline-offset-4">
            Recharger
          </button>
        </div>
      </div>
    }

    <main class="mx-auto max-w-3xl px-4 py-8">
      <router-outlet />
    </main>

    <footer class="mx-auto max-w-3xl px-4 pb-8 text-sm text-ink-soft">
      <a routerLink="/about" class="underline underline-offset-4 hover:text-ink">À propos et licences</a>
    </footer>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly update = inject(AppUpdateService);
}
