import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { WeeklyLeaderboardDto, WeeklyMetric } from '@kanadrill/shared';
import { StatsService } from '../../core/stats.service';

interface MetricText {
  intro: string;
  list: string;
  unit: (n: number) => string;
  detail: (n: number) => string;
  empty: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export const WEEKLY_TEXTS: Record<WeeklyMetric, MetricText> = {
  answers: {
    intro: 'Le plus de cartes tentées depuis lundi, réussies ou non, tous exercices confondus.',
    list: 'Classement des réponses de la semaine',
    unit: (n) => plural(n, 'réponse', 'réponses'),
    detail: (n) => `${n} % de réussite`,
    empty: "Personne n'a encore répondu cette semaine : lance une session pour ouvrir le bal.",
  },
  drawing: {
    intro:
      'Chaque tracé réussi rapporte sa précision (jusqu\'à 100 points), un tracé raté rien. Les tracés se font sur téléphone, dans une session avec l\'exercice « Écriture ».',
    list: 'Classement des points de tracé de la semaine',
    unit: (n) => `${n} pt${n > 1 ? 's' : ''}`,
    detail: (n) => plural(n, 'tracé', 'tracés'),
    empty: "Personne n'a encore de points cette semaine : fais un tracé sur ton téléphone.",
  },
};

/** Un classement de la semaine (remis à zéro chaque lundi) : réponses données, ou points de tracé. */
@Component({
  selector: 'app-weekly-board',
  imports: [RouterLink, DatePipe],
  template: `
    @if (error()) {
      <p role="alert" class="text-seal">Impossible de charger le classement pour l'instant.</p>
    } @else if (board(); as b) {
      <p class="text-ink-soft">{{ text().intro }} Remise à zéro {{ b.nextWeekStart | date: 'EEEE d MMMM' }}.</p>

      @if (!b.me.visible) {
        <div class="border-l-4 border-ink bg-paper p-4" role="note">
          <p class="font-medium">Tu es masqué du classement.</p>
          <p class="text-sm text-ink-soft">
            Les autres ne te voient pas. Tu peux changer ça dans
            <a routerLink="/profile" class="underline underline-offset-4">ton profil</a>.
          </p>
        </div>
      }

      @if (b.entries.length > 0) {
        <ol class="flex flex-col gap-2" [attr.aria-label]="text().list">
          @for (entry of b.entries; track $index) {
            <li
              class="flex items-center gap-3 border bg-paper px-3 py-3 sm:gap-4 sm:px-4"
              [class]="entry.isMe ? 'border-ink' : 'border-line'"
              [attr.aria-current]="entry.isMe ? 'true' : null"
            >
              <span class="w-8 shrink-0 text-center text-xl font-semibold tabular-nums" [class.text-ink-soft]="entry.rank > 3">{{ entry.rank }}</span>
              @if (entry.avatarUrl) {
                <img [src]="entry.avatarUrl" alt="" width="40" height="40" class="size-10 shrink-0 rounded-full bg-snow" />
              } @else {
                <span class="size-10 shrink-0 rounded-full bg-line" aria-hidden="true"></span>
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">
                  {{ entry.username }}
                  @if (entry.isMe) {
                    <span class="ml-1 bg-ink px-2 py-0.5 text-xs font-medium text-on-ink">Toi</span>
                  }
                </span>
                <span class="text-sm text-ink-soft">{{ text().detail(entry.detail) }}</span>
              </span>
              <span class="shrink-0 text-right text-xl font-semibold tabular-nums">{{ text().unit(entry.value) }}</span>
            </li>
          }
        </ol>
      } @else {
        <p class="text-ink-soft">{{ text().empty }}</p>
      }

      @if (!isListed(b)) {
        <section class="flex flex-col gap-2 border border-line bg-paper p-4" aria-labelledby="weekly-me-title">
          <h2 id="weekly-me-title" class="text-lg font-medium">Ta semaine</h2>
          @if (b.me.value > 0 && b.me.visible) {
            <p>Tu es {{ b.me.rank }}{{ b.me.rank === 1 ? 'er' : 'e' }} avec {{ text().unit(b.me.value) }} ({{ text().detail(b.me.detail) }}).</p>
          } @else if (b.me.value > 0) {
            <p>{{ text().unit(b.me.value) }} ({{ text().detail(b.me.detail) }}), visible de toi seul.</p>
          } @else {
            <p>
              Rien pour l'instant cette semaine.
              <a routerLink="/review/new" class="underline underline-offset-4">Lance une session</a> pour marquer des points.
            </p>
          }
        </section>
      }
    } @else {
      <p role="status" class="text-ink-soft">Chargement…</p>
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class WeeklyBoard {
  private readonly api = inject(StatsService);

  readonly metric = input.required<WeeklyMetric>();
  protected readonly board = signal<WeeklyLeaderboardDto | null>(null);
  protected readonly error = signal(false);
  protected readonly text = () => WEEKLY_TEXTS[this.metric()];

  constructor() {
    effect(() => {
      const metric = this.metric();
      this.board.set(null);
      this.error.set(false);
      this.api.loadWeeklyLeaderboard(metric).then(
        (board) => {
          if (this.metric() === metric) this.board.set(board);
        },
        () => this.error.set(true),
      );
    });
  }

  protected isListed(board: WeeklyLeaderboardDto): boolean {
    return board.entries.some((entry) => entry.isMe);
  }
}
