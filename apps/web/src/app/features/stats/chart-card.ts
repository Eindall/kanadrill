import { Component, input, signal } from '@angular/core';

/** Tableau équivalent d'un graphique : chaque valeur y est lisible sans la couleur, la souris ni le survol. */
export interface ChartTable {
  head: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number>>;
}

/**
 * Cadre commun des graphiques : un titre qui dit ce qu'on regarde, un sous-titre, la vue graphique et sa vue « tableau »
 * (le jumeau accessible : toute valeur y est lisible sans survol). Le graphique reste affiché, légèrement atténué,
 * pendant un rechargement : pas de squelette qui saute.
 */
@Component({
  selector: 'app-chart-card',
  template: `
    <section class="flex flex-col gap-3 border border-line bg-paper p-4" [attr.aria-labelledby]="titleId()">
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 [id]="titleId()" class="text-lg font-medium">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="text-sm text-ink-soft">{{ subtitle() }}</p>
          }
        </div>
        @if (table()) {
          <button
            type="button"
            (click)="asTable.set(!asTable())"
            [attr.aria-pressed]="asTable()"
            class="shrink-0 border border-line px-3 py-1.5 text-sm hover:border-ink"
          >
            {{ asTable() ? 'Graphique' : 'Tableau' }}
          </button>
        }
      </header>

      <div class="transition-opacity" [class.opacity-50]="loading()">
        @if (asTable() && table(); as t) {
          <div class="max-h-72 overflow-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-line text-ink-soft">
                  @for (heading of t.head; track $index) {
                    <th scope="col" class="py-1.5 pr-3 font-medium">{{ heading }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of t.rows; track $index) {
                  <tr class="border-b border-line/60">
                    @for (cell of row; track $index) {
                      <td class="py-1.5 pr-3 tabular-nums">{{ cell }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <ng-content />
        }
      </div>
    </section>
  `,
})
export class ChartCard {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly table = input<ChartTable | null>(null);
  readonly loading = input(false);

  protected readonly asTable = signal(false);
  private static next = 0;
  private readonly id = `chart-${ChartCard.next++}`;
  protected titleId = () => this.id;
}
