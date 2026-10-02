import { Component, computed, input } from '@angular/core';
import type { DayActivityDto } from '@kanadrill/shared';
import { dayState, longDay, weekdayLetter } from './stats-helpers';

/**
 * Les jours récents face à l'objectif, façon timeline : un petit point creux (rien), un point moyen (quelques cartes, sous
 * l'objectif), un grand point avec un trophée (objectif atteint). La taille et l'icône portent l'information en plus
 * de la couleur ; aujourd'hui est cerclé.
 */
@Component({
  selector: 'app-streak-timeline',
  template: `
    <ol class="grid grid-cols-7 gap-1" [attr.aria-label]="'Les ' + days().length + ' derniers jours'">
      @for (day of cells(); track day.date) {
        <li class="flex flex-col items-center gap-2" [attr.aria-label]="day.description" [attr.aria-current]="day.today ? 'date' : null">
          <span class="flex h-10 items-center justify-center">
            @switch (day.state) {
              @case ('goal') {
                <span class="flex size-10 items-center justify-center rounded-full bg-ok text-paper" [class]="ring(day.today)">
                  <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
                    <path d="M8 6H5.5A1.5 1.5 0 0 0 4 7.5C4 9.5 5.5 11 8 11M16 6h2.5A1.5 1.5 0 0 1 20 7.5C20 9.5 18.5 11 16 11" />
                    <path d="M12 13v3M9 20h6M10 16h4v4h-4z" />
                  </svg>
                </span>
              }
              @case ('partial') {
                <span class="size-5 rounded-full bg-ink-faint" [class]="ring(day.today)"></span>
              }
              @default {
                <span class="size-3 rounded-full border-2 border-ink-soft/50 bg-paper" [class]="ring(day.today)"></span>
              }
            }
          </span>
          <span class="text-xs" [class]="day.today ? 'font-semibold text-ink' : 'text-ink-soft'" aria-hidden="true">{{ day.letter }}</span>
        </li>
      }
    </ol>
    @if (legend()) {
      <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span class="inline-flex items-center gap-1.5"><span class="size-3 rounded-full border-2 border-ink-soft/50"></span>aucune carte</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-3 rounded-full bg-ink-faint"></span>sous l'objectif</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-3 rounded-full bg-ok"></span>objectif atteint</span>
      </p>
    }
  `,
})
export class StreakTimeline {
  readonly days = input.required<readonly DayActivityDto[]>();
  readonly goal = input.required<number>();
  /** Le dernier jour de la liste est aujourd'hui. */
  readonly legend = input(true);

  protected readonly cells = computed(() =>
    this.days().map((day, index, all) => {
      const state = dayState(day.answers, this.goal());
      const status = state === 'goal' ? 'objectif atteint' : state === 'partial' ? 'objectif non atteint' : 'aucune carte';
      return {
        date: day.date,
        state,
        letter: weekdayLetter(day.date),
        today: index === all.length - 1,
        description: `${longDay(day.date)} : ${day.answers} ${day.answers > 1 ? 'cartes' : 'carte'} sur ${this.goal()}, ${status}`,
      };
    }),
  );

  protected ring(today: boolean): string {
    return today ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : '';
  }
}
