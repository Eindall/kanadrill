import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LeaderboardDto, LeaderboardEntryDto } from '@kanadrill/shared';
import { StatsService } from '../../core/stats.service';
import { FlameIcon } from '../stats/flame-icon';

@Component({
  selector: 'app-leaderboard-page',
  imports: [RouterLink, FlameIcon],
  template: `
    <section class="flex flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight">Classement</h1>
        <p class="text-ink-soft">Les plus longues séries de jours d'apprentissage : un jour compte dès que tu réponds à une carte.</p>
      </div>

      @if (error()) {
        <p role="alert" class="text-seal">Impossible de charger le classement pour l'instant.</p>
      } @else if (board(); as b) {
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
          <ol class="flex flex-col gap-2" aria-label="Classement des séries">
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
                      <span class="ml-1 bg-ink px-2 py-0.5 text-xs font-medium text-paper">Toi</span>
                    }
                  </span>
                  <span class="text-sm text-ink-soft">record : {{ days(entry.longestStreak) }}</span>
                </span>
                <span class="flex min-w-16 shrink-0 items-center justify-end gap-1.5 text-xl font-semibold tabular-nums">
                  <span class="size-6 text-ink"><app-flame-icon /></span>
                  {{ entry.currentStreak }}<span class="sr-only"> {{ entry.currentStreak > 1 ? 'jours' : 'jour' }} de série</span>
                </span>
              </li>
            }
          </ol>
        } @else {
          <p class="text-ink-soft">Personne n'a de série en cours : réponds à une carte pour ouvrir le bal.</p>
        }

        @if (!isListed(b)) {
          <section class="flex flex-col gap-2 border border-line bg-paper p-4" aria-labelledby="me-title">
            <h2 id="me-title" class="text-lg font-medium">Ta série</h2>
            @if (b.me.currentStreak > 0 && b.me.visible) {
              <p>Tu es {{ b.me.rank }}{{ b.me.rank === 1 ? 'er' : 'e' }} avec {{ days(b.me.currentStreak) }} de série (record : {{ days(b.me.longestStreak) }}).</p>
            } @else if (b.me.currentStreak > 0) {
              <p>{{ days(b.me.currentStreak) }} de série (record : {{ days(b.me.longestStreak) }}), visible de toi seul.</p>
            } @else {
              <p>
                Pas de série en cours (record : {{ days(b.me.longestStreak) }}).
                <a routerLink="/review/new" class="underline underline-offset-4">Lance une session</a> pour en commencer une.
              </p>
            }
          </section>
        }
      } @else {
        <p role="status" class="text-ink-soft">Chargement…</p>
      }
    </section>
  `,
})
export class LeaderboardPage {
  private readonly api = inject(StatsService);

  protected readonly board = signal<LeaderboardDto | null>(null);
  protected readonly error = signal(false);

  constructor() {
    this.api.loadLeaderboard().then(
      (board) => this.board.set(board),
      () => this.error.set(true),
    );
  }

  protected days(n: number): string {
    return `${n} ${n > 1 ? 'jours' : 'jour'}`;
  }

  protected isListed(board: LeaderboardDto): boolean {
    return board.entries.some((entry: LeaderboardEntryDto) => entry.isMe);
  }
}
