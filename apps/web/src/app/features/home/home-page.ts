import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ReviewOverviewDto, StatsOverviewDto } from '@kanadrill/shared';
import { AuthService } from '../../core/auth.service';
import { goalProgress } from '../../core/goal';
import { ReviewService } from '../../core/review.service';
import { StatsService } from '../../core/stats.service';
import { FlameIcon } from '../stats/flame-icon';
import { StreakTimeline } from '../stats/streak-timeline';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, FlameIcon, StreakTimeline],
  template: `
    <section class="flex flex-col gap-8">
      <h1 class="text-2xl font-semibold tracking-tight">Bonjour {{ auth.user()?.username }}</h1>

      @if (streak(); as s) {
        <a routerLink="/stats" class="flex flex-col gap-4 border border-line bg-paper p-5 hover:border-ink" aria-label="Voir mes statistiques">
          <span class="flex items-center gap-4">
            <span class="size-11 shrink-0" [class]="s.streak.current > 0 ? 'text-ink' : 'text-line'"><app-flame-icon /></span>
            <span>
              <span class="block text-2xl font-semibold leading-none">{{ s.streak.current }} {{ s.streak.current > 1 ? 'jours' : 'jour' }}</span>
              <span class="text-sm text-ink-soft">
                @if (s.streak.current === 0) {
                  de série : réponds à une carte pour commencer
                } @else if (s.streak.activeToday) {
                  de série : c'est bon pour aujourd'hui
                } @else {
                  de série : réponds à une carte aujourd'hui pour la garder
                }
              </span>
            </span>
          </span>
          <app-streak-timeline [days]="s.recent" [goal]="s.dailyGoal" [legend]="false" />
        </a>
      }

      <div class="flex flex-col gap-5 border border-line bg-paper p-6">
        <p class="font-kana text-5xl leading-none" aria-hidden="true">ひらがな</p>

        @if (error()) {
          <p role="alert" class="text-seal">Impossible de charger tes révisions pour l'instant.</p>
        } @else if (overview(); as o) {
          <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-4">
              <h2 id="goal-title" class="text-lg font-medium">Objectif du jour</h2>
              <span class="tabular-nums text-ink-soft">{{ o.answersToday }} / {{ o.dailyGoal }} cartes</span>
            </div>
            <div
              class="h-3 bg-line"
              role="progressbar"
              aria-labelledby="goal-title"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-valuenow]="percent()"
            >
              <div class="h-full bg-ink transition-[width]" [class.bg-ok]="percent() === 100" [style.width.%]="percent()"></div>
            </div>
            <p class="text-sm text-ink-soft">
              @if (percent() === 100) {
                Objectif atteint, bravo. Tu peux continuer si tu veux.
              } @else {
                {{ percent() }}&nbsp;% : encore {{ o.dailyGoal - o.answersToday }} cartes à tenter.
              }
            </p>
          </div>

          @if (due() > 0) {
            <p class="text-ink-soft">{{ due() }} {{ due() > 1 ? 'cartes' : 'carte' }} à revoir maintenant.</p>
          }

          <a routerLink="/review/new" class="self-start bg-seal px-6 py-3 text-lg font-medium text-paper hover:bg-seal-dark">
            Nouvelle session
          </a>
        } @else {
          <p role="status" class="text-ink-soft">Chargement de tes révisions…</p>
        }
      </div>
    </section>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly reviews = inject(ReviewService);
  private readonly stats = inject(StatsService);

  protected readonly streak = signal<StatsOverviewDto | null>(null);

  protected readonly overview = signal<ReviewOverviewDto | null>(null);
  protected readonly error = signal(false);

  protected readonly percent = computed(() => {
    const o = this.overview();
    return o ? goalProgress(o.answersToday, o.dailyGoal) : 0;
  });
  protected readonly due = computed(() =>
    Object.values(this.overview()?.available ?? {}).reduce((sum, type) => sum + (type?.due ?? 0), 0),
  );

  constructor() {
    // La série est un confort : sans elle, le reste de l'accueil s'affiche quand même.
    this.stats.loadOverview().then(
      (overview) => this.streak.set(overview),
      () => undefined,
    );
    this.reviews.loadOverview().then(
      (overview) => this.overview.set(overview),
      () => this.error.set(true),
    );
  }
}
