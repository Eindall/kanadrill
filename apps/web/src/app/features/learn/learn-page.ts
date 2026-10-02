import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CatalogItemDto, ItemType } from '@kanadrill/shared';
import { CatalogService } from '../../core/catalog.service';
import { TYPE_LABELS } from '../review/session-config';
import { GROUP_LABELS, layoutCatalog, MASTERY_LABELS, masterySummary } from './catalog-layout';
import { MasteryMeter } from './mastery-meter';

const SCRIPTS: ItemType[] = ['hiragana', 'katakana'];

@Component({
  selector: 'app-learn-page',
  imports: [RouterLink, MasteryMeter],
  template: `
    <section class="flex flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight">Apprendre</h1>
        <p class="text-ink-soft">Ouvre un kana pour voir sa fiche et l'ordre de ses traits.</p>
      </div>

      <div role="tablist" aria-label="Écriture" class="grid grid-cols-2 gap-3">
        @for (script of scripts; track script) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="script === selected()"
            (click)="selected.set(script)"
            class="border px-4 py-3 font-medium"
            [class]="script === selected() ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink'"
          >
            {{ labels[script] }}
          </button>
        }
      </div>

      @if (error()) {
        <p role="alert" class="text-seal">Impossible de charger le catalogue pour l'instant.</p>
      } @else if (items()) {
        <p class="text-sm text-ink-soft">
          {{ summary().mastered }} solides · {{ summary().known }} connus · {{ summary().learning }} en cours ·
          {{ summary().unseen }} pas encore vus
        </p>

        @for (layout of layouts(); track layout.group) {
          <section class="flex flex-col gap-3" [attr.aria-labelledby]="'group-' + layout.group">
            <h2 [id]="'group-' + layout.group" class="text-lg font-medium">{{ groupLabels[layout.group] }}</h2>
            <ul class="grid gap-2" [style.grid-template-columns]="'repeat(' + layout.columns + ', minmax(0, 1fr))'">
              @for (cell of layout.cells; track $index) {
                <li>
                  @if (cell; as item) {
                    <a
                      [routerLink]="['/learn', item.id]"
                      class="flex flex-col items-center gap-1 border border-line bg-paper px-1 pb-2 pt-2 hover:border-ink"
                      [attr.aria-label]="item.character + ', ' + item.reading + ', ' + masteryLabels[item.mastery]"
                    >
                      <span class="font-kana text-3xl leading-none" aria-hidden="true">{{ item.character }}</span>
                      <span class="text-xs text-ink-soft" aria-hidden="true">{{ item.reading }}</span>
                      <app-mastery-meter class="mt-1 w-full max-w-10" [level]="item.mastery" />
                    </a>
                  }
                </li>
              }
            </ul>
          </section>
        }

        <p class="text-sm text-ink-soft">
          Le trait sous chaque kana indique où tu en es : vide = pas encore vu, plein = solide.
        </p>
      } @else {
        <p role="status" class="text-ink-soft">Chargement…</p>
      }
    </section>
  `,
})
export class LearnPage {
  private readonly catalog = inject(CatalogService);

  protected readonly scripts = SCRIPTS;
  protected readonly labels = TYPE_LABELS;
  protected readonly groupLabels = GROUP_LABELS;
  protected readonly masteryLabels = MASTERY_LABELS;

  protected readonly items = signal<CatalogItemDto[] | null>(null);
  protected readonly error = signal(false);
  protected readonly selected = signal<ItemType>('hiragana');

  protected readonly layouts = computed(() => layoutCatalog(this.items() ?? [], this.selected()));
  protected readonly summary = computed(() =>
    masterySummary((this.items() ?? []).filter((item) => item.type === this.selected())),
  );

  constructor() {
    this.catalog.loadCatalog().then(
      (items) => this.items.set(items),
      () => this.error.set(true),
    );
  }
}
