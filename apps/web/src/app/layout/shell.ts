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

    <footer class="mx-auto max-w-3xl px-4 pb-8 text-sm text-ink-soft">
      <a routerLink="/about" class="underline underline-offset-4 hover:text-ink">À propos et licences</a>
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
