import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ItemDetailDto } from '@kanadrill/shared';
import { CatalogService } from '../../core/catalog.service';
import { TYPE_LABELS } from '../review/session-config';
import { GROUP_LABELS, MASTERY_LABELS } from './catalog-layout';
import { MasteryMeter } from './mastery-meter';
import { StrokeOrder } from './stroke-order';

@Component({
  selector: 'app-item-page',
  imports: [RouterLink, DatePipe, MasteryMeter, StrokeOrder],
  template: `
    <section class="flex flex-col gap-6">
      <a routerLink="/learn" class="self-start text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
        ← Tous les kana
      </a>

      @if (error()) {
        <p role="alert" class="text-seal">Cet élément est introuvable.</p>
      } @else if (item(); as item) {
        <div class="flex items-center gap-6 border border-line bg-paper p-6">
          <p class="shrink-0 whitespace-nowrap font-kana text-6xl leading-none sm:text-8xl" lang="ja">{{ item.character }}</p>
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-2xl font-semibold tracking-tight">{{ item.reading }}</h1>
            <p class="text-sm text-ink-soft">
              {{ typeLabels[item.type] }}
              @if (item.group) {
                · {{ groupLabels[item.group] }}
              }
            </p>
            @if (item.readings.length > 1) {
              <p class="text-sm text-ink-soft">Aussi accepté en saisie : {{ item.readings.slice(1).join(', ') }}</p>
            }
          </div>
        </div>

        @if (item.strokes.length > 0) {
          <section class="flex flex-col gap-3" aria-labelledby="strokes-title">
            <h2 id="strokes-title" class="text-lg font-medium">Ordre des traits</h2>
            <app-stroke-order [strokes]="item.strokes" />
          </section>
        }

        <section class="flex flex-col gap-3" aria-labelledby="progress-title">
          <h2 id="progress-title" class="text-lg font-medium">Ta maîtrise</h2>
          <div class="flex flex-col gap-3 border border-line bg-paper p-4">
            <div class="flex items-center gap-4">
              <app-mastery-meter class="w-16" [level]="item.mastery" />
              <span class="font-medium">{{ masteryLabels[item.mastery] }}</span>
            </div>
            @if (item.reps > 0) {
              <p class="text-sm text-ink-soft">
                {{ item.reps }} {{ item.reps > 1 ? 'réponses' : 'réponse' }}, dont {{ item.lapses }}
                {{ item.lapses > 1 ? 'ratées' : 'ratée' }}.
                @if (item.nextDue) {
                  Prochaine révision : {{ item.nextDue | date: 'd MMMM à HH:mm' }}.
                }
              </p>
            } @else {
              <p class="text-sm text-ink-soft">Tu n'as pas encore répondu sur ce kana. Il arrivera dans tes sessions.</p>
            }
          </div>
        </section>
      } @else {
        <p role="status" class="text-ink-soft">Chargement…</p>
      }
    </section>
  `,
})
export class ItemPage {
  private readonly catalog = inject(CatalogService);

  /** Identifiant de la route `/learn/:id` (liaison des paramètres de route). */
  readonly id = input.required<string>();

  protected readonly typeLabels = TYPE_LABELS;
  protected readonly groupLabels = GROUP_LABELS;
  protected readonly masteryLabels = MASTERY_LABELS;

  protected readonly item = signal<ItemDetailDto | null>(null);
  protected readonly error = signal(false);

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      let current = true;
      onCleanup(() => (current = false));
      this.item.set(null);
      this.error.set(false);
      this.catalog.loadItem(id).then(
        (item) => current && this.item.set(item),
        () => current && this.error.set(true),
      );
    });
  }
}
