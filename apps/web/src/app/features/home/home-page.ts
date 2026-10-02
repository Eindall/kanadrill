import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ReviewOverviewDto } from '@kanadrill/shared';
import { AuthService } from '../../core/auth.service';
import { goalProgress } from '../../core/goal';
import { ReviewService } from '../../core/review.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <section class="flex flex-col gap-8">
      <h1 class="text-2xl font-semibold tracking-tight">Bonjour {{ auth.user()?.username }}</h1>

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
    this.reviews.loadOverview().then(
      (overview) => this.overview.set(overview),
      () => this.error.set(true),
    );
  }
}
