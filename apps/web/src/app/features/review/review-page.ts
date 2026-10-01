import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isRomajiCorrect, type SessionConfig } from '@kanadrill/shared';
import { ReviewService } from '../../core/review.service';
import { advanceQueue, summarize, toQueue, type Attempt, type QueueEntry } from './review-queue';
import { configFromParams, TYPE_LABELS } from './session-config';

type Phase = 'loading' | 'error' | 'question' | 'feedback' | 'done';

interface Feedback {
  correct: boolean;
  expected: string;
  answer: string;
  /** Enregistrement de la réponse auprès du serveur en cours. */
  saving: boolean;
  saveError: boolean;
}

@Component({
  selector: 'app-review-page',
  imports: [RouterLink, DatePipe, DecimalPipe],
  host: { '(window:keydown)': 'onKeydown($event)' },
  template: `
    @switch (phase()) {
      @case ('loading') {
        <p role="status" class="py-16 text-center text-ink-soft">Préparation de ta session…</p>
      }

      @case ('error') {
        <div role="alert" class="flex flex-col items-start gap-4 border-l-4 border-seal bg-paper p-5">
          <p class="font-medium">{{ errorMessage() }}</p>
          <div class="flex flex-wrap gap-3">
            <button type="button" (click)="start()" class="bg-ink px-6 py-3 font-medium text-paper hover:bg-ink/90">
              Réessayer
            </button>
            <a routerLink="/review/new" class="border border-ink px-6 py-3 font-medium hover:bg-ink hover:text-paper">
              Changer de réglage
            </a>
          </div>
        </div>
      }

      @case ('done') {
        @let s = summary();
        <section class="flex flex-col gap-8" aria-labelledby="done-title">
          <div>
            <h1 id="done-title" class="text-2xl font-semibold tracking-tight">Session terminée</h1>
            <p class="text-ink-soft">
              @if (s.successRate === 100) {
                Sans faute, bravo.
              } @else if (s.successRate >= 70) {
                Du bon travail. Les cartes ratées reviendront bientôt.
              } @else {
                Les erreurs sont normales : elles reviendront bientôt, c'est le principe.
              }
            </p>
          </div>

          <dl class="grid grid-cols-3 gap-px border border-line bg-line text-center">
            <div class="bg-paper p-4">
              <dt class="text-sm text-ink-soft">Cartes</dt>
              <dd class="text-3xl font-semibold">{{ s.cards }}</dd>
            </div>
            <div class="bg-paper p-4">
              <dt class="text-sm text-ink-soft">Réussite</dt>
              <dd class="text-3xl font-semibold">{{ s.successRate }}&nbsp;%</dd>
            </div>
            <div class="bg-paper p-4">
              <dt class="text-sm text-ink-soft">Temps moyen</dt>
              <dd class="text-3xl font-semibold">{{ s.averageDurationMs / 1000 | number: '1.1-1' }}&nbsp;s</dd>
            </div>
          </dl>

          @if (s.missed.length > 0) {
            <div class="flex flex-col gap-3">
              <h2 class="text-lg font-medium">À retravailler</h2>
              <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                @for (miss of s.missed; track miss.item.id) {
                  <li class="flex items-center gap-4 border border-line bg-paper px-4 py-3">
                    <span class="font-kana text-4xl leading-none" lang="ja">{{ miss.item.character }}</span>
                    <span class="text-lg">{{ miss.expected }}</span>
                  </li>
                }
              </ul>
            </div>
          }

          @if (s.nextDue) {
            <p class="text-sm text-ink-soft">Prochaine révision à prévoir le {{ s.nextDue | date: 'EEEE d MMMM, HH:mm' }}.</p>
          }

          <div class="flex flex-col gap-3 sm:flex-row">
            <a routerLink="/" class="bg-ink px-6 py-3 text-center font-medium text-paper hover:bg-ink/90">
              Retour à l'accueil
            </a>
            <button
              type="button"
              (click)="start()"
              class="border border-ink px-6 py-3 font-medium hover:bg-ink hover:text-paper"
            >
              Relancer la même session
            </button>
            <a routerLink="/review/new" class="border border-ink px-6 py-3 text-center font-medium hover:bg-ink hover:text-paper">
              Changer de réglage
            </a>
          </div>
        </section>
      }

      @default {
        @if (card(); as current) {
          <section class="flex flex-col gap-6" aria-label="Révision">
            <div class="flex items-center gap-4">
              <a routerLink="/" class="text-sm text-ink-soft underline underline-offset-4">Quitter</a>
              <div
                class="h-2 flex-1 bg-line"
                role="progressbar"
                aria-label="Progression de la session"
                aria-valuemin="0"
                [attr.aria-valuemax]="total()"
                [attr.aria-valuenow]="completed()"
              >
                <div class="h-full bg-ink transition-[width]" [style.width.%]="(completed() / total()) * 100"></div>
              </div>
              <span class="text-sm tabular-nums text-ink-soft">{{ completed() }} / {{ total() }}</span>
            </div>

            <div class="flex flex-col items-center gap-2 border border-line bg-paper px-4 py-8">
              <p class="flex gap-2 text-xs uppercase tracking-wide text-ink-soft">
                <span>{{ typeLabel(current.item.type) }}</span>
                @if (current.isNew) {
                  <span class="font-semibold text-ink">· Nouveau</span>
                }
              </p>
              <p class="font-kana text-[7rem] leading-none sm:text-[9rem]" lang="ja">{{ current.item.character }}</p>
            </div>

            @if (current.mode === 'choice') {
              <div class="grid grid-cols-2 gap-3" role="group" aria-label="Quelle est la lecture ?">
                @for (choice of current.choices; track choice; let i = $index) {
                  <button
                    type="button"
                    [disabled]="phase() === 'feedback'"
                    (click)="answer(choice)"
                    [class]="choiceClass(choice)"
                  >
                    <span class="mr-2 text-xs text-ink-soft max-sm:hidden" aria-hidden="true">{{ i + 1 }}</span>{{ choice }}
                  </button>
                }
              </div>
            } @else {
              @if (phase() === 'question') {
                <form class="flex flex-col gap-3 sm:flex-row" (submit)="submitTyped($event)">
                  <input
                    #answerInput
                    type="text"
                    aria-label="Lecture en romaji"
                    placeholder="Lecture en romaji"
                    autocomplete="off"
                    autocapitalize="none"
                    autocorrect="off"
                    spellcheck="false"
                    enterkeyhint="done"
                    [value]="typed()"
                    (input)="typed.set(answerInput.value)"
                    class="min-w-0 flex-1 border border-line bg-paper px-4 py-4 text-center text-2xl"
                  />
                  <button
                    type="submit"
                    [disabled]="typed().trim() === ''"
                    class="bg-ink px-8 py-4 text-lg font-medium text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Valider
                  </button>
                </form>
              }
            }

            <div aria-live="polite" class="min-h-28">
              @if (feedback(); as f) {
                <div
                  class="flex flex-col gap-4 border-l-4 bg-paper p-4"
                  [class.border-ok]="f.correct"
                  [class.border-seal]="!f.correct"
                >
                  <p class="text-lg font-semibold" [class.text-ok]="f.correct" [class.text-seal]="!f.correct">
                    @if (f.correct) {
                      <span aria-hidden="true">✓ </span>Bonne réponse
                    } @else {
                      <span aria-hidden="true">✗ </span>Raté
                    }
                  </p>
                  @if (!f.correct) {
                    <p>
                      C'était «&nbsp;<strong>{{ f.expected }}</strong>&nbsp;»@if (current.mode === 'typing') {
                        <span class="text-ink-soft"> (tu as écrit «&nbsp;{{ f.answer }}&nbsp;»)</span>
                      }.
                    </p>
                  } @else if (current.item.readings.length > 1 && f.answer.trim().toLowerCase() !== f.expected) {
                    <p class="text-sm text-ink-soft">Lecture de référence : {{ f.expected }}</p>
                  }
                  @if (f.saveError) {
                    <p role="alert" class="text-sm text-seal">Ta réponse n'a pas pu être enregistrée.</p>
                    <button type="button" (click)="retry()" class="self-start bg-seal px-6 py-3 font-medium text-paper hover:bg-seal-dark">
                      Réessayer
                    </button>
                  } @else {
                    <button
                      #nextButton
                      type="button"
                      [disabled]="f.saving"
                      (click)="next()"
                      class="bg-ink px-6 py-3 text-lg font-medium text-paper hover:bg-ink/90 disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  }
                </div>
              }
            </div>
          </section>
        }
      }
    }
  `,
})
export class ReviewPage {
  private readonly reviews = inject(ReviewService);
  private readonly router = inject(Router);
  /** Réglage de la session, lu dans l'URL ; `null` si invalide (on renvoie alors vers l'écran de réglage). */
  private readonly config: SessionConfig | null = configFromParams(inject(ActivatedRoute).snapshot.queryParamMap);

  protected readonly phase = signal<Phase>('loading');
  protected readonly queue = signal<QueueEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly errorMessage = signal('');
  protected readonly attempts = signal<Attempt[]>([]);
  protected readonly feedback = signal<Feedback | null>(null);
  protected readonly typed = signal('');

  protected readonly entry = computed(() => this.queue()[0] ?? null);
  protected readonly card = computed(() => this.entry()?.card ?? null);
  protected readonly completed = computed(() => this.total() - this.queue().length);
  protected readonly summary = computed(() => summarize(this.attempts()));

  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly answerInput = viewChild<ElementRef<HTMLInputElement>>('answerInput');

  private shownAt = 0;
  private pendingSave: (() => Promise<void>) | null = null;

  constructor() {
    // Le focus suit le flux : sur « Suivant » après une réponse (Entrée enchaîne), sur le champ pour la saisie.
    effect(() => this.nextButton()?.nativeElement.focus());
    effect(() => this.answerInput()?.nativeElement.focus());
    if (this.config) {
      void this.start();
    } else {
      void this.router.navigate(['/review/new'], { replaceUrl: true });
    }
  }

  async start(): Promise<void> {
    if (!this.config) return;
    this.phase.set('loading');
    this.attempts.set([]);
    this.feedback.set(null);
    this.typed.set('');
    try {
      const session = await this.reviews.loadSession(this.config);
      this.queue.set(toQueue(session.cards));
      this.total.set(session.cards.length);
      this.showQuestion();
    } catch (error) {
      // 400 = sélection sans carte : le serveur explique pourquoi ; sinon, problème réseau ou serveur.
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 400 && typeof error.error?.message === 'string'
          ? error.error.message
          : 'Impossible de charger ta session.',
      );
      this.phase.set('error');
    }
  }

  protected typeLabel(type: keyof typeof TYPE_LABELS): string {
    return TYPE_LABELS[type];
  }

  protected choiceClass(choice: string): string {
    const base = 'min-h-16 border px-4 py-3 text-2xl transition-colors disabled:cursor-default ';
    const f = this.feedback();
    if (!f) return base + 'border-line bg-paper hover:border-ink';
    if (choice === f.expected) return base + 'border-ok bg-ok/10 font-semibold text-ok';
    if (choice === f.answer) return base + 'border-seal bg-seal/10 text-seal';
    return base + 'border-line bg-paper opacity-50';
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Raccourcis 1–4 pour le QCM (clavier physique).
    const card = this.card();
    if (this.phase() !== 'question' || card?.mode !== 'choice' || event.ctrlKey || event.metaKey || event.altKey) return;
    const choice = card.choices?.[Number(event.key) - 1];
    if (choice !== undefined) void this.answer(choice);
  }

  protected submitTyped(event: Event): void {
    // Pas de soumission native du <form> (rechargement de page).
    event.preventDefault();
    if (this.typed().trim() !== '') void this.answer(this.typed());
  }

  protected async answer(text: string): Promise<void> {
    const entry = this.entry();
    if (!entry || this.phase() !== 'question') return;
    const card = entry.card;
    const durationMs = Math.round(performance.now() - this.shownAt);

    // Retour immédiat avec la même logique que le serveur ; la réponse du serveur fait foi ensuite.
    this.feedback.set({
      correct: isRomajiCorrect(text, card.item.readings),
      expected: card.item.readings[0],
      answer: text,
      saving: true,
      saveError: false,
    });
    this.phase.set('feedback');

    this.pendingSave = async () => {
      this.feedback.update((f) => f && { ...f, saving: true, saveError: false });
      try {
        const result = await this.reviews.submit({ itemId: card.item.id, mode: card.mode, answer: text, durationMs });
        this.attempts.update((list) => [
          ...list,
          { key: entry.key, card, correct: result.correct, expected: result.expected, durationMs, nextDue: result.nextDue },
        ]);
        this.feedback.update((f) => f && { ...f, correct: result.correct, expected: result.expected, saving: false });
        this.pendingSave = null;
      } catch {
        this.feedback.update((f) => f && { ...f, saving: false, saveError: true });
      }
    };
    await this.pendingSave();
  }

  protected retry(): void {
    void this.pendingSave?.();
  }

  protected next(): void {
    const f = this.feedback();
    if (!f || f.saving || f.saveError) return;
    this.queue.update((queue) => advanceQueue(queue, f.correct));
    this.feedback.set(null);
    this.typed.set('');
    if (this.queue().length === 0) {
      this.phase.set('done');
    } else {
      this.showQuestion();
    }
  }

  private showQuestion(): void {
    this.phase.set('question');
    this.shownAt = performance.now();
  }
}
