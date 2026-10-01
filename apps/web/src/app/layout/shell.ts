import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet],
  template: `
    <header class="border-b border-line bg-paper">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <a routerLink="/" class="text-lg font-semibold tracking-tight">KanaDrill</a>

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

    <main class="mx-auto max-w-3xl px-4 py-8">
      <router-outlet />
    </main>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
}
