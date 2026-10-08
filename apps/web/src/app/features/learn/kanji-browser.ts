import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  KANJI_LEVELS,
  KANJI_PAGE_SIZE,
  type KanjiLevel,
  type KanjiLevelSummaryDto,
  type KanjiListItemDto,
} from '@kanadrill/shared';
import { CatalogService } from '../../core/catalog.service';
import { MASTERY_LABELS } from './catalog-layout';
import { MasteryMeter } from './mastery-meter';

export const LEVEL_LABELS: Record<KanjiLevel, string> = { N5: 'N5', N4: 'N4', N3: 'N3', N2: 'N2', N1: 'N1', other: 'Autres' };

/** Au-delà de ce nombre, l'ajout d'un niveau entier mérite une mise en garde (ça remplit les sessions). */
const BIG_LEVEL = 300;

/**
 * Liste des kanji du mode « Apprendre » : un niveau JLPT à la fois (N5 à N1, puis « Autres »), ou le résultat d'une
 * recherche (caractères, sens, lecture) sur tous les niveaux. Seuls les kanji ajoutés au dictionnaire sont révisés.
 */
@Component({
  selector: 'app-kanji-browser',
  imports: [RouterLink, MasteryMeter],
  template: `
    <div class="flex flex-col gap-5">
      <form class="flex gap-2" role="search" (submit)="$event.preventDefault(); search(box.value)">
        <input
          #box
          type="search"
          aria-label="Rechercher un kanji"
          placeholder="Un kanji (日), un sens ou une lecture"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          enterkeyhint="search"
          [value]="q()"
          (input)="onType(box.value)"
          class="min-w-0 flex-1 border border-line bg-paper px-4 py-3"
        />
        @if (q()) {
          <button type="button" (click)="box.value = ''; search('')" class="border border-ink px-4 font-medium hover:bg-ink hover:text-on-ink">
            Effacer
          </button>
        }
      </form>

      <div role="tablist" aria-label="Niveau JLPT" class="grid grid-cols-3 gap-2 sm:grid-cols-6">
        @for (summary of levels(); track summary.level) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="!searching() && summary.level === level()"
            (click)="levelChange.emit(summary.level)"
            class="flex flex-col items-center border px-2 py-2"
            [class]="!searching() && summary.level === level() ? 'border-ink bg-ink text-on-ink' : 'border-line bg-paper hover:border-ink'"
          >
            <span class="font-medium">{{ labels[summary.level] }}</span>
            <span class="text-xs tabular-nums opacity-80">{{ summary.inDictionary }} / {{ summary.total }}</span>
          </button>
        }
      </div>

      @if (error()) {
        <p role="alert" class="text-seal">Impossible de charger les kanji pour l'instant.</p>
      } @else {
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 class="text-lg font-medium" aria-live="polite">
            @if (searching()) {
              {{ total() }} {{ total() > 1 ? 'résultats' : 'résultat' }} pour «&nbsp;{{ q() }}&nbsp;»
            } @else {
              {{ labels[level()] }} · {{ total() }} kanji
            }
          </h2>
          @if (canAddLevel()) {
            @if (!confirming()) {
              <button
                type="button"
                (click)="confirming.set(true)"
                class="border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-on-ink"
              >
                Tout ajouter à mon dictionnaire
              </button>
            }
          }
        </div>

        @if (confirming()) {
          <div class="flex flex-col gap-3 border-l-4 border-ink bg-paper p-4" role="group" aria-label="Confirmer l'ajout du niveau">
            <p>
              Ajouter les {{ missing() }} kanji de {{ labels[level()] }} qui n'y sont pas encore ? Ils arriveront dans tes
              sessions de révision@if (missing() >= bigLevel) {
                <strong> : c'est beaucoup, tu peux aussi les ajouter un par un depuis leur fiche</strong>}.
            </p>
            <div class="flex gap-3">
              <button type="button" [disabled]="adding()" (click)="addLevel()" class="bg-ink px-5 py-2 font-medium text-on-ink hover:bg-ink/90 disabled:opacity-40">
                Ajouter
              </button>
              <button type="button" (click)="confirming.set(false)" class="border border-ink px-5 py-2 font-medium hover:bg-ink hover:text-on-ink">
                Annuler
              </button>
            </div>
          </div>
        }

        @if (items().length > 0) {
          <ul class="grid grid-cols-4 gap-2 sm:grid-cols-5">
            @for (item of items(); track item.id) {
              <li>
                <a
                  [routerLink]="['/learn', item.id]"
                  class="flex h-full flex-col items-center gap-1 border bg-paper px-1 pb-2 pt-2 hover:border-ink"
                  [class]="item.inDictionary ? 'border-ink/60' : 'border-line'"
                  [attr.aria-label]="describe(item)"
                >
                  <span class="font-kana text-3xl leading-none" lang="ja" aria-hidden="true">{{ item.character }}</span>
                  <span class="line-clamp-1 w-full text-center text-xs text-ink-soft" aria-hidden="true">{{ item.meaning }}</span>
                  @if (item.inDictionary) {
                    <app-mastery-meter class="mt-1 w-full max-w-10" [level]="item.mastery" />
                  } @else {
                    <span class="mt-1 h-1 w-full max-w-10 border-t border-dashed border-line" aria-hidden="true"></span>
                  }
                </a>
              </li>
            }
          </ul>
          @if (items().length < total()) {
            <button
              type="button"
              [disabled]="loading()"
              (click)="loadMore()"
              class="self-center border border-ink px-6 py-3 font-medium hover:bg-ink hover:text-on-ink disabled:opacity-40"
            >
              Afficher plus ({{ total() - items().length }} restants)
            </button>
          }
          <p class="text-sm text-ink-soft">
            Trait plein sous le kanji : dans ton dictionnaire, avec ta maîtrise ; pointillé : pas encore ajouté.
          </p>
        } @else if (loading()) {
          <p role="status" class="text-ink-soft">Chargement…</p>
        } @else {
          <p class="text-ink-soft">Aucun kanji ne correspond.</p>
        }
      }
    </div>
  `,
})
export class KanjiBrowser {
  private readonly catalog = inject(CatalogService);

  readonly level = input<KanjiLevel>('N5');
  readonly q = input('');
  readonly levelChange = output<KanjiLevel>();
  readonly searchChange = output<string>();

  protected readonly labels = LEVEL_LABELS;
  protected readonly bigLevel = BIG_LEVEL;
  protected readonly levels = signal<KanjiLevelSummaryDto[]>(
    KANJI_LEVELS.map((level) => ({ level, total: 0, inDictionary: 0 })),
  );
  protected readonly items = signal<KanjiListItemDto[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly confirming = signal(false);
  protected readonly adding = signal(false);

  protected readonly searching = computed(() => this.q().trim() !== '');
  protected readonly missing = computed(() => {
    const summary = this.levels().find((candidate) => candidate.level === this.level());
    return summary ? summary.total - summary.inDictionary : 0;
  });
  protected readonly canAddLevel = computed(() => !this.searching() && this.missing() > 0);

  private debounce: ReturnType<typeof setTimeout> | undefined;
  /** Numéro de la requête en cours : une réponse tardive d'une recherche abandonnée est ignorée. */
  private request = 0;

  constructor() {
    void this.refreshLevels();
    // Nouvelle liste à chaque changement de niveau ou de recherche.
    effect(() => {
      this.level();
      this.q();
      this.confirming.set(false);
      void this.loadFirstPage();
    });
  }

  protected describe(item: KanjiListItemDto): string {
    const state = item.inDictionary ? `dans ton dictionnaire, ${MASTERY_LABELS[item.mastery].toLowerCase()}` : 'pas dans ton dictionnaire';
    return `${item.character}, ${item.meaning}, ${state}`;
  }

  /** Recherche au fil de la frappe, avec un petit délai pour ne pas interroger l'API à chaque lettre. */
  protected onType(value: string): void {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.search(value), 350);
  }

  protected search(value: string): void {
    clearTimeout(this.debounce);
    if (value.trim() !== this.q().trim()) this.searchChange.emit(value.trim());
  }

  protected async loadMore(): Promise<void> {
    await this.fetchPage(this.items().length, true);
  }

  protected async addLevel(): Promise<void> {
    this.adding.set(true);
    try {
      await this.catalog.addLevelToDictionary(this.level());
      this.confirming.set(false);
      await Promise.all([this.refreshLevels(), this.loadFirstPage()]);
    } catch {
      this.error.set(true);
    } finally {
      this.adding.set(false);
    }
  }

  private async refreshLevels(): Promise<void> {
    try {
      this.levels.set(await this.catalog.loadKanjiLevels());
    } catch {
      this.error.set(true);
    }
  }

  private loadFirstPage(): Promise<void> {
    return this.fetchPage(0, false);
  }

  private async fetchPage(offset: number, append: boolean): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set(false);
    if (!append) this.items.set([]);
    try {
      const page = await this.catalog.loadKanji({
        level: this.searching() ? undefined : this.level(),
        q: this.q(),
        offset,
        limit: KANJI_PAGE_SIZE,
      });
      if (request !== this.request) return;
      this.items.update((list) => (append ? [...list, ...page.items] : page.items));
      this.total.set(page.total);
    } catch {
      if (request === this.request) this.error.set(true);
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}
