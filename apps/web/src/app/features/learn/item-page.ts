import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
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
      @if (item(); as item) {
        <a
          routerLink="/learn"
          [queryParams]="backParams()"
          class="self-start text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          ← {{ item.kanji ? 'Tous les kanji' : 'Tous les kana' }}
        </a>
      } @else {
        <a routerLink="/learn" class="self-start text-sm text-ink-soft underline underline-offset-4 hover:text-ink">← Apprendre</a>
      }

      @if (error()) {
        <p role="alert" class="text-seal">Cet élément est introuvable.</p>
      } @else if (item(); as item) {
        <div class="flex items-center gap-6 border border-line bg-paper p-6">
          <p class="shrink-0 whitespace-nowrap font-kana text-6xl leading-none sm:text-8xl" lang="ja">{{ item.character }}</p>
          <div class="flex min-w-0 flex-col gap-1">
            @if (item.kanji; as kanji) {
              <h1 class="text-2xl font-semibold tracking-tight">{{ item.meanings[0] }}</h1>
              <p class="text-sm text-ink-soft">
                Kanji
                @if (kanji.jlpt) {
                  · JLPT {{ kanji.jlpt }}
                }
                @if (kanji.strokeCount) {
                  · {{ kanji.strokeCount }} {{ kanji.strokeCount > 1 ? 'traits' : 'trait' }}
                }
              </p>
            } @else {
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
            }
          </div>
        </div>

        @if (item.kanji; as kanji) {
          <section class="flex flex-col gap-3" aria-labelledby="meanings-title">
            <h2 id="meanings-title" class="text-lg font-medium">Sens</h2>
            <p class="border border-line bg-paper p-4">{{ item.meanings.join(', ') }}</p>
            @if (kanji.language === 'en') {
              <p class="text-sm text-ink-soft">Sens en anglais : KANJIDIC2 n'a pas de traduction française pour ce kanji.</p>
            }
          </section>

          <section class="flex flex-col gap-3" aria-labelledby="readings-title">
            <h2 id="readings-title" class="text-lg font-medium">Lectures</h2>
            <dl class="grid gap-px border border-line bg-line sm:grid-cols-2">
              <div class="flex flex-col gap-1 bg-paper p-4">
                <dt class="text-sm text-ink-soft">On (d'origine chinoise)</dt>
                <dd class="font-kana text-xl" lang="ja">{{ kanji.on.length ? kanji.on.join('、') : '—' }}</dd>
              </div>
              <div class="flex flex-col gap-1 bg-paper p-4">
                <dt class="text-sm text-ink-soft">Kun (japonaises)</dt>
                <dd class="font-kana text-xl" lang="ja">{{ kanji.kun.length ? kanji.kun.join('、') : '—' }}</dd>
              </div>
            </dl>
            <p class="text-sm text-ink-soft">Dans les lectures kun, le point sépare la racine de la terminaison, et le tiret marque un suffixe ou un préfixe.</p>
          </section>

          <section class="flex flex-col gap-3" aria-labelledby="dictionary-title">
            <h2 id="dictionary-title" class="text-lg font-medium">Mon dictionnaire</h2>
            @if (kanji.inDictionary) {
              <p class="text-sm text-ink-soft">Ce kanji est dans ton dictionnaire : il apparaît dans tes sessions de révision.</p>
              @if (!confirmingRemoval()) {
                <button
                  type="button"
                  (click)="confirmingRemoval.set(true)"
                  class="self-start border border-ink px-5 py-3 font-medium hover:bg-ink hover:text-paper"
                >
                  Retirer de mon dictionnaire
                </button>
              } @else {
                <div class="flex flex-col gap-3 border-l-4 border-seal bg-paper p-4" role="group" aria-label="Confirmer le retrait">
                  <p>Retirer ce kanji efface ta progression dessus (l'historique de tes réponses reste). Continuer ?</p>
                  <div class="flex gap-3">
                    <button type="button" [disabled]="busy()" (click)="toggleDictionary()" class="bg-seal px-5 py-2 font-medium text-paper hover:bg-seal-dark disabled:opacity-40">
                      Retirer
                    </button>
                    <button type="button" (click)="confirmingRemoval.set(false)" class="border border-ink px-5 py-2 font-medium hover:bg-ink hover:text-paper">
                      Annuler
                    </button>
                  </div>
                </div>
              }
            } @else {
              <p class="text-sm text-ink-soft">Ajoute ce kanji pour le réviser : il entrera dans tes sessions comme une carte neuve.</p>
              <button
                type="button"
                [disabled]="busy()"
                (click)="toggleDictionary()"
                class="self-start bg-ink px-6 py-3 text-lg font-medium text-paper hover:bg-ink/90 disabled:opacity-40"
              >
                Ajouter à mon dictionnaire
              </button>
            }
            @if (actionError()) {
              <p role="alert" class="text-sm text-seal">L'opération a échoué, réessaie dans un instant.</p>
            }
          </section>
        }

        @if (item.strokes.length > 0) {
          <section class="flex flex-col gap-3" aria-labelledby="strokes-title">
            <h2 id="strokes-title" class="text-lg font-medium">Ordre des traits</h2>
            <app-stroke-order [strokes]="item.strokes" />
          </section>
        } @else if (item.kanji) {
          <p class="text-sm text-ink-soft">L'ordre des traits n'est pas disponible pour ce kanji (il n'est pas dans KanjiVG).</p>
        }

        @if (!item.kanji || item.kanji.inDictionary) {
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
                <p class="text-sm text-ink-soft">
                  Tu n'as pas encore répondu sur {{ item.kanji ? 'ce kanji' : 'ce kana' }}. Il arrivera dans tes sessions.
                </p>
              }
            </div>
          </section>
        }

        @if (item.kanji; as kanji) {
          <p class="text-xs text-ink-soft">
            Grade {{ kanji.grade ?? '—' }} · fréquence {{ kanji.frequency ?? '—' }} · données KANJIDIC2, KanjiVG et listes JLPT de Jonathan Waller
            (<a routerLink="/about" class="underline underline-offset-4">licences</a>).
          </p>
        }
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
  protected readonly busy = signal(false);
  protected readonly actionError = signal(false);
  protected readonly confirmingRemoval = signal(false);

  /** Retour à la liste, sur le bon onglet (et le bon niveau pour un kanji). */
  protected readonly backParams = computed(() => {
    const item = this.item();
    if (!item) return {};
    return item.kanji ? { tab: 'kanji', level: item.kanji.jlpt ?? 'other' } : { tab: item.type };
  });

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      let current = true;
      onCleanup(() => (current = false));
      this.item.set(null);
      this.error.set(false);
      this.confirmingRemoval.set(false);
      this.catalog.loadItem(id).then(
        (item) => current && this.item.set(item),
        () => current && this.error.set(true),
      );
    });
  }

  /** Ajoute le kanji au dictionnaire, ou l'en retire (après confirmation), puis relit la fiche. */
  protected async toggleDictionary(): Promise<void> {
    const item = this.item();
    if (!item?.kanji) return;
    this.busy.set(true);
    this.actionError.set(false);
    try {
      if (item.kanji.inDictionary) await this.catalog.removeFromDictionary(item.id);
      else await this.catalog.addToDictionary([item.id]);
      this.confirmingRemoval.set(false);
      this.item.set(await this.catalog.loadItem(item.id));
    } catch {
      this.actionError.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
