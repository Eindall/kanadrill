import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  KANA_TYPES,
  SESSION_SIZES,
  SESSION_TYPES,
  type ItemType,
  type ReviewMode,
  type ReviewOverviewDto,
  type SessionSize,
} from '@kanadrill/shared';
import { isTouchDevice } from '../../core/device';
import { ReviewService } from '../../core/review.service';
import {
  adaptToDevice,
  configToParams,
  familiesWithoutMode,
  loadSavedConfig,
  MODE_HINTS,
  MODE_LABELS,
  reconcileModes,
  saveConfig,
  TYPE_LABELS,
  validateConfig,
} from './session-config';

/** Classes d'une case à cocher / d'un choix : la bordure et le fond suivent l'état de l'`<input>` caché. */
const OPTION =
  'flex cursor-pointer items-center gap-3 border border-line bg-paper px-4 py-3 has-checked:border-ink has-checked:bg-ink/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-seal has-disabled:cursor-not-allowed has-disabled:opacity-60';

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
        <legend class="mb-1 text-lg font-medium">Que réviser ?</legend>
        @for (type of types; track type) {
          <label [class]="option">
            <input
              type="checkbox"
              class="size-5 accent-ink"
              [checked]="selectedTypes().includes(type)"
              [disabled]="isUnavailable(type)"
              (change)="toggleType(type)"
            />
            <span class="flex flex-1 flex-wrap items-baseline justify-between gap-x-4">
              <span class="font-medium">{{ typeLabels[type] }}</span>
              @if (overview(); as o) {
                <span class="text-sm text-ink-soft">
                  @if (type === 'kanji') {
                    {{ o.available[type]?.total }} dans ton dictionnaire · {{ o.available[type]?.due }} à revoir
                  } @else {
                    {{ o.available[type]?.total }} cartes · {{ o.available[type]?.due }} à revoir
                  }
                </span>
              }
            </span>
          </label>
        }
        @if (kanjiAvailable() === false) {
          <p class="text-sm text-ink-soft">
            Les kanji se révisent une fois ajoutés à ton dictionnaire.
            <a routerLink="/learn" [queryParams]="{ tab: 'kanji' }" class="underline underline-offset-4">Choisir des kanji</a>
          </p>
        }
      </fieldset>

      <fieldset class="flex flex-col gap-5">
        <legend class="mb-1 text-lg font-medium">Exercices</legend>

        @if (showKana()) {
          <div class="flex flex-col gap-3" role="group" aria-labelledby="modes-kana">
            <h2 id="modes-kana" class="text-sm font-medium uppercase tracking-wide text-ink-soft">Kana</h2>
            @for (mode of kanaModes; track mode) {
              <label [class]="option">
                <input type="checkbox" class="size-5 accent-ink" [checked]="selectedModes().includes(mode)" (change)="toggleMode(mode)" />
                <span class="flex flex-col">
                  <span class="font-medium">{{ modeLabels[mode] }}</span>
                  @if (modeHints[mode]; as hint) {
                    <span class="text-sm text-ink-soft">{{ hint }}</span>
                  }
                </span>
              </label>
            }
          </div>
        }

        @if (showKanji()) {
          <div class="flex flex-col gap-3" role="group" aria-labelledby="modes-kanji">
            <h2 id="modes-kanji" class="text-sm font-medium uppercase tracking-wide text-ink-soft">Kanji</h2>
            @for (mode of kanjiModes; track mode) {
              <label [class]="option">
                <input type="checkbox" class="size-5 accent-ink" [checked]="selectedModes().includes(mode)" (change)="toggleMode(mode)" />
                <span class="flex flex-col">
                  <span class="font-medium">{{ modeLabels[mode] }}</span>
                  @if (modeHints[mode]; as hint) {
                    <span class="text-sm text-ink-soft">{{ hint }}</span>
                  }
                </span>
              </label>
            }
          </div>
        }

        @if (touch && (showKana() || showKanji())) {
          <div class="flex flex-col gap-3" role="group" aria-labelledby="modes-drawing">
            <h2 id="modes-drawing" class="text-sm font-medium uppercase tracking-wide text-ink-soft">Écriture</h2>
            <label [class]="option">
              <input type="checkbox" class="size-5 accent-ink" [checked]="selectedModes().includes('drawing')" (change)="toggleMode('drawing')" />
              <span class="flex flex-col">
                <span class="font-medium">{{ modeLabels.drawing }}</span>
                <span class="text-sm text-ink-soft">{{ modeHints.drawing }}</span>
              </span>
            </label>
          </div>
        }
      </fieldset>

      @if (missing().length > 0) {
        <p role="alert" class="text-sm text-seal">
          Choisis au moins un exercice pour {{ missing().includes('kana') ? 'les kana' : 'les kanji' }}@if (missing().length > 1) {
            et pour les kanji}.
        </p>
      } @else if (!valid()) {
        <p role="alert" class="text-sm text-seal">Choisis au moins une écriture et un type d'exercice.</p>
      }

      <div class="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          [disabled]="!canLaunch()"
          (click)="launch()"
          class="bg-seal px-8 py-3 text-lg font-medium text-on-seal hover:bg-seal-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lancer la session
        </button>
        <a routerLink="/" class="border border-ink px-6 py-3 text-center font-medium hover:bg-ink hover:text-on-ink">
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
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly modeLabels = MODE_LABELS;
  protected readonly modeHints = MODE_HINTS;
  protected readonly kanaModes: readonly ReviewMode[] = ['choice', 'typing', 'reverse'];
  protected readonly kanjiModes: readonly ReviewMode[] = ['meaning', 'reading', 'kanjiReverse'];
  /** Le tracé n'est proposé que sur écran tactile. */
  protected readonly touch = isTouchDevice();

  private readonly saved = adaptToDevice(loadSavedConfig(), this.touch);
  protected readonly count = signal<SessionSize>(this.saved.count);
  protected readonly selectedTypes = signal<ItemType[]>(this.saved.types);
  protected readonly selectedModes = signal<ReviewMode[]>(this.saved.modes);
  protected readonly overview = signal<ReviewOverviewDto | null>(null);

  protected readonly showKana = computed(() => this.selectedTypes().some((type) => KANA_TYPES.includes(type)));
  protected readonly showKanji = computed(() => this.selectedTypes().includes('kanji'));
  /** `false` tant que le dictionnaire ne contient aucun kanji (une fois connu) ; `null` : pas encore connu. */
  protected readonly kanjiAvailable = computed(() => {
    const total = this.overview()?.available['kanji']?.total;
    return total === undefined ? null : total > 0;
  });
  protected readonly missing = computed(() => familiesWithoutMode(this.selectedTypes(), this.selectedModes()));
  protected readonly valid = computed(
    () => validateConfig({ count: this.count(), types: this.selectedTypes(), modes: this.selectedModes() }) !== null,
  );
  protected readonly canLaunch = computed(() => this.valid() && this.missing().length === 0);

  constructor() {
    // Les compteurs sont un confort : si le chargement échoue, on peut quand même lancer la session.
    this.reviews.loadOverview().then(
      (overview) => {
        this.overview.set(overview);
        // Un réglage mémorisé avec les kanji ne tient plus si le dictionnaire est vide.
        if (overview.available['kanji']?.total === 0 && this.selectedTypes().includes('kanji')) {
          this.setTypes(this.selectedTypes().filter((type) => type !== 'kanji'));
        }
      },
      () => undefined,
    );
  }

  protected isUnavailable(type: ItemType): boolean {
    return type === 'kanji' && this.kanjiAvailable() === false;
  }

  protected toggleType(type: ItemType): void {
    const list = this.selectedTypes();
    this.setTypes(list.includes(type) ? list.filter((t) => t !== type) : [...list, type]);
  }

  /** Change les types cochés et remet les exercices en cohérence (ex. cocher « Kanji » ajoute le sens). */
  private setTypes(types: ItemType[]): void {
    this.selectedTypes.set(types);
    this.selectedModes.update((modes) => reconcileModes(types, modes, this.touch));
  }

  protected toggleMode(mode: ReviewMode): void {
    this.selectedModes.update((list) => (list.includes(mode) ? list.filter((m) => m !== mode) : [...list, mode]));
  }

  protected launch(): void {
    const config = validateConfig({ count: this.count(), types: this.selectedTypes(), modes: this.selectedModes() });
    if (!config || !this.canLaunch()) return;
    saveConfig(config);
    void this.router.navigate(['/review'], { queryParams: configToParams(config) });
  }
}
