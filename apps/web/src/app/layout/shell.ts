import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AppUpdateService } from '../core/app-update.service';
import { AuthService } from '../core/auth.service';
import { Logo } from './logo';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Logo],
  template: `
    <header class="border-b border-line bg-paper">
      <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 px-4 pt-3 sm:flex-nowrap sm:py-3">
        <app-logo />

        <!-- Sur mobile le menu passe sur sa propre ligne, sous le logo et l'avatar -->
        <nav aria-label="Navigation principale" class="order-last flex w-full gap-4 overflow-x-auto pt-1 text-[0.95rem] max-[380px]:gap-3 max-[380px]:text-sm sm:order-none sm:w-auto sm:flex-1 sm:gap-5 sm:overflow-visible sm:pt-0 sm:text-base">
          @for (link of links; track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive="border-ink! text-ink!"
              [routerLinkActiveOptions]="{ exact: link.exact }"
              ariaCurrentWhenActive="page"
              class="whitespace-nowrap border-b-2 border-transparent py-2 text-ink-soft hover:text-ink"
            >
              {{ link.label }}
            </a>
          }
        </nav>

        <div class="flex items-center gap-3">
          <!-- Pas pendant une session (« Quitter » est dans la session) ni sur l'écran de réglage : ce serait le même bouton -->
          @if (showNewSession()) {
            <a routerLink="/review/new" class="whitespace-nowrap bg-seal px-4 py-2 text-sm font-medium text-paper hover:bg-seal-dark">
              Nouvelle session
            </a>
          }
          @if (auth.user(); as user) {
            <a routerLink="/profile" class="flex items-center gap-3" [attr.aria-label]="'Mon profil, ' + user.username">
              <span class="max-w-32 truncate text-sm text-ink-soft max-md:hidden">{{ user.username }}</span>
              @if (user.avatarUrl) {
                <img [src]="user.avatarUrl" alt="" width="36" height="36" class="size-9 rounded-full bg-snow" />
              } @else {
                <span class="size-9 rounded-full bg-line" aria-hidden="true"></span>
              }
            </a>
          }
        </div>
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

    <footer class="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-8 text-sm text-ink-soft">
      <a routerLink="/about" class="underline underline-offset-4 hover:text-ink">À propos et licences</a>
      <span class="hidden sm:inline" aria-hidden="true">〜</span>
      <a
        href="https://ko-fi.com/tongcho7"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-2 underline underline-offset-4 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" class="size-5 shrink-0 text-[#FF5E5B]" fill="currentColor" aria-hidden="true">
          <path
            d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"
          />
        </svg>
        Envie de me soutenir ? Envoyez-moi un pourboire
      </a>
    </footer>
  `,
})
export class Shell {
  /** Le menu principal. */
  protected readonly links = [
    { path: '/', label: 'Accueil', exact: true },
    { path: '/learn', label: 'Apprendre', exact: false },
    { path: '/stats', label: 'Statistiques', exact: false },
    { path: '/leaderboard', label: 'Classement', exact: false },
  ];
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly showNewSession = computed(() => !this.url().startsWith('/review'));
  protected readonly update = inject(AppUpdateService);
}
