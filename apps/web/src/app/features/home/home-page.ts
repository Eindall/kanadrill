import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ReviewSessionDto } from '@kanadrill/shared';
import { AuthService } from '../../core/auth.service';
import { ReviewService } from '../../core/review.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <section class="flex flex-col gap-8">
      <h1 class="text-2xl font-semibold tracking-tight">Bonjour {{ auth.user()?.username }}</h1>

      <div class="flex flex-col gap-4 border border-line bg-paper p-6">
        <p class="font-kana text-5xl leading-none" aria-hidden="true">ひらがな</p>

        @if (error()) {
          <p role="alert" class="text-seal">Impossible de charger tes révisions pour l'instant.</p>
        } @else if (session(); as s) {
          @if (s.cards.length > 0) {
            <div class="flex flex-col gap-1">
              <h2 class="text-lg font-medium">{{ s.cards.length }} {{ s.cards.length > 1 ? 'cartes' : 'carte' }} à réviser</h2>
              <p class="text-ink-soft">{{ s.counts.due }} à revoir · {{ s.counts.new }} {{ s.counts.new > 1 ? 'nouvelles' : 'nouvelle' }}</p>
            </div>
            <a routerLink="/review" class="self-start bg-seal px-6 py-3 text-lg font-medium text-paper hover:bg-seal-dark">
              Commencer la session
            </a>
          } @else {
            <div class="flex flex-col gap-1">
              <h2 class="text-lg font-medium">Rien à réviser pour l'instant</h2>
              <p class="max-w-prose text-ink-soft">
                Tu es à jour. Les cartes reviennent quand elles sont dues, et de nouvelles arrivent chaque jour.
              </p>
            </div>
          }
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

  protected readonly session = signal<ReviewSessionDto | null>(null);
  protected readonly error = signal(false);

  constructor() {
    this.reviews.loadSession().then(
      (session) => this.session.set(session),
      () => this.error.set(true),
    );
  }
}
