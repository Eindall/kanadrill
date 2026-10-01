import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  REVIEW_MODES,
  SESSION_SIZES,
  SESSION_TYPES,
  type ItemType,
  type ReviewMode,
  type ReviewOverviewDto,
  type SessionSize,
} from '@kanadrill/shared';
import { ReviewService } from '../../core/review.service';
import { configToParams, loadSavedConfig, MODE_LABELS, saveConfig, TYPE_LABELS, validateConfig } from './session-config';

/** Classes d'une case à cocher / d'un choix : la bordure et le fond suivent l'état de l'`<input>` caché. */
const OPTION =
  'flex cursor-pointer items-center gap-3 border border-line bg-paper px-4 py-3 has-checked:border-ink has-checked:bg-ink/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-seal';

@Component({
  selector: 'app-setup-page',
  imports: [RouterLink],
  template: `
    <section class="flex flex-col gap-8">
      <h1 class="text-2xl font-semibold tracking-tight">Nouvelle session</h1>

      <fieldset class="flex flex-col gap-3">
        <legend class="mb-1 text-lg font-medium">Nombre de cartes</legend>
        <div class="grid grid-cols-3 gap-3">
          @for (size of sizes; track size) {
            <label [class]="option + ' justify-center text-xl font-semibold'">
              <input
                type="radio"
                name="count"
                class="sr-only"
                [value]="size"
                [checked]="count() === size"
                (change)="count.set(size)"
              />
              {{ size }}
            </label>
          }
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-3">
        <legend class="mb-1 text-lg font-medium">Écritures</legend>
        @for (type of types; track type) {
          <label [class]="option">
            <input
              type="checkbox"
              class="size-5 accent-ink"
              [checked]="selectedTypes().includes(type)"
              (change)="toggleType(type)"
            />
            <span class="flex flex-1 flex-wrap items-baseline justify-between gap-x-4">
              <span class="font-medium">{{ typeLabels[type] }}</span>
              @if (overview(); as o) {
                <span class="text-sm text-ink-soft">
                  {{ o.available[type]?.total }} cartes · {{ o.available[type]?.due }} à revoir
                </span>
              }
            </span>
          </label>
        }
      </fieldset>

      <fieldset class="flex flex-col gap-3">
        <legend class="mb-1 text-lg font-medium">Exercices</legend>
        @for (mode of modes; track mode) {
          <label [class]="option">
            <input
              type="checkbox"
              class="size-5 accent-ink"
              [checked]="selectedModes().includes(mode)"
              (change)="toggleMode(mode)"
            />
            <span class="font-medium">{{ modeLabels[mode] }}</span>
          </label>
        }
      </fieldset>

      @if (!valid()) {
        <p role="alert" class="text-sm text-seal">Choisis au moins une écriture et un type d'exercice.</p>
      }

      <div class="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          [disabled]="!valid()"
          (click)="launch()"
          class="bg-seal px-8 py-3 text-lg font-medium text-paper hover:bg-seal-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lancer la session
        </button>
        <a routerLink="/" class="border border-ink px-6 py-3 text-center font-medium hover:bg-ink hover:text-paper">
          Annuler
        </a>
      </div>
    </section>
  `,
})
export class SetupPage {
  private readonly router = inject(Router);
  private readonly reviews = inject(ReviewService);

  protected readonly option = OPTION;
  protected readonly sizes = SESSION_SIZES;
  protected readonly types = SESSION_TYPES;
  protected readonly modes = REVIEW_MODES;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly modeLabels = MODE_LABELS;

  private readonly saved = loadSavedConfig();
  protected readonly count = signal<SessionSize>(this.saved.count);
  protected readonly selectedTypes = signal<ItemType[]>(this.saved.types);
  protected readonly selectedModes = signal<ReviewMode[]>(this.saved.modes);
  protected readonly overview = signal<ReviewOverviewDto | null>(null);

  protected readonly valid = computed(
    () => validateConfig({ count: this.count(), types: this.selectedTypes(), modes: this.selectedModes() }) !== null,
  );

  constructor() {
    // Les compteurs sont un confort : si le chargement échoue, on peut quand même lancer la session.
    this.reviews.loadOverview().then(
      (overview) => this.overview.set(overview),
      () => undefined,
    );
  }

  protected toggleType(type: ItemType): void {
    this.selectedTypes.update((list) => (list.includes(type) ? list.filter((t) => t !== type) : [...list, type]));
  }

  protected toggleMode(mode: ReviewMode): void {
    this.selectedModes.update((list) => (list.includes(mode) ? list.filter((m) => m !== mode) : [...list, mode]));
  }

  protected launch(): void {
    const config = validateConfig({ count: this.count(), types: this.selectedTypes(), modes: this.selectedModes() });
    if (!config) return;
    saveConfig(config);
    void this.router.navigate(['/review'], { queryParams: configToParams(config) });
  }
}
