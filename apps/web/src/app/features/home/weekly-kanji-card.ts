import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { WeeklyKanjiDto } from '@kanadrill/shared';
import { CatalogService } from '../../core/catalog.service';
import { longDay } from '../stats/stats-helpers';

/**
 * « Kanji de la semaine » : un kanji du niveau JLPT le plus bas où il reste des kanji à ajouter, le même jusqu'au lundi
 * (le serveur le garde). On peut ouvrir sa fiche ou l'ajouter au dictionnaire d'un geste, avec une confirmation.
 * Rien ne s'affiche tant que la suggestion n'est pas chargée, ni quand il ne reste plus aucun kanji à ajouter.
 */
@Component({
  selector: 'app-weekly-kanji-card',
  imports: [RouterLink],
  template: `
    @if (kanji(); as k) {
      <section class="flex flex-col gap-4 border border-line bg-paper p-5" aria-labelledby="weekly-kanji-title">
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="weekly-kanji-title" class="text-lg font-medium">Kanji de la semaine</h2>
          @if (k.jlpt) {
            <span class="text-sm text-ink-soft">JLPT {{ k.jlpt }}</span>
          }
        </div>

        <a
          [routerLink]="['/learn', k.id]"
          class="group flex items-center gap-5"
          [attr.aria-label]="'Voir la fiche du kanji ' + k.character + ' : ' + meanings()"
        >
          <span class="font-kana text-7xl leading-none" lang="ja" aria-hidden="true">{{ k.character }}</span>
          <span class="flex min-w-0 flex-col gap-1">
            <span class="text-xl font-semibold leading-tight">{{ meanings() }}</span>
            @if (readings()) {
              <span class="text-sm text-ink-soft" lang="ja">{{ readings() }}</span>
            }
            <span class="text-sm underline underline-offset-4 group-hover:text-ink">Voir la fiche</span>
          </span>
        </a>

        @if (k.inDictionary) {
          <p role="status" class="flex flex-col gap-0.5 border-l-4 border-ok bg-snow px-4 py-3 text-sm">
            <span class="font-medium text-ok"><span aria-hidden="true">✓ </span>{{ justAdded() ? 'Ajouté à ton dictionnaire' : 'Dans ton dictionnaire' }}</span>
            <span class="text-ink-soft">
              @if (justAdded()) {
                Il fera partie de tes prochaines sessions.
              }
              Nouveau kanji {{ nextMonday() }}.
            </span>
          </p>
        } @else {
          <button
            type="button"
            [disabled]="adding()"
            (click)="add(k)"
            class="self-start bg-ink px-6 py-3 font-medium text-paper hover:bg-ink/90 disabled:opacity-40"
          >
            Ajouter à mon dictionnaire
          </button>
          <p class="text-sm text-ink-soft">Un nouveau kanji arrive {{ nextMonday() }}.</p>
        }
        @if (error()) {
          <p role="alert" class="text-sm text-seal">L'ajout a échoué, réessaie dans un instant.</p>
        }
      </section>
    }
  `,
})
export class WeeklyKanjiCard {
  private readonly catalog = inject(CatalogService);

  protected readonly kanji = signal<WeeklyKanjiDto | null>(null);
  protected readonly adding = signal(false);
  protected readonly justAdded = signal(false);
  protected readonly error = signal(false);

  protected readonly meanings = computed(() => this.kanji()?.meanings.join(', ') ?? '');
  protected readonly readings = computed(() => {
    const k = this.kanji();
    return k ? [...k.on, ...k.kun].join('、') : '';
  });
  /** « lundi 19 octobre ». */
  protected readonly nextMonday = computed(() => {
    const k = this.kanji();
    return k ? longDay(k.nextChange) : '';
  });

  constructor() {
    // Un confort : si le chargement échoue, l'accueil s'affiche sans cette carte.
    this.catalog.loadWeeklyKanji().then(
      (kanji) => this.kanji.set(kanji),
      () => undefined,
    );
  }

  protected async add(kanji: WeeklyKanjiDto): Promise<void> {
    this.adding.set(true);
    this.error.set(false);
    try {
      await this.catalog.addToDictionary([kanji.id]);
      this.justAdded.set(true);
      this.kanji.set({ ...kanji, inDictionary: true });
    } catch {
      this.error.set(true);
    } finally {
      this.adding.set(false);
    }
  }
}
