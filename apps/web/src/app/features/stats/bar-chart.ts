import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { labelIndices, niceScale } from './stats-helpers';

export interface BarDatum {
  /** Étiquette de l'axe horizontal (affichée seulement pour quelques barres). */
  label: string;
  /** Texte complet affiché au survol, au toucher et au focus (la valeur d'abord). */
  readout: string;
  value: number;
  /** `good` : objectif atteint (vert) ; `muted` : sous l'objectif (gris-bleu clair) ; `base` : couleur neutre. */
  tone?: 'base' | 'muted' | 'good';
}

/**
 * Histogramme en HTML/CSS (texte net à toute taille) : barres fines (24 px au plus, arrondies en haut, posées sur une
 * base commune), un seul axe, quadrillage en traits fins pleins, repère d'objectif facultatif (nommé par la légende
 * du graphique, pas par une étiquette posée sur les barres). Chaque barre est un bouton :
 * survol, toucher et focus clavier (flèches, début, fin) affichent le détail dans la ligne de lecture au-dessus.
 */
@Component({
  selector: 'app-bar-chart',
  template: `
    <p class="mb-2 min-h-5 text-sm" aria-live="polite">
      @if (activeBar(); as bar) {
        {{ bar.readout }}
      } @else {
        <span class="text-ink-soft">{{ hint() }}</span>
      }
    </p>

    <div class="relative h-44 pl-9">
      @for (tick of scale().ticks; track tick) {
        <div class="absolute inset-x-0 border-t border-line" [style.bottom.%]="(tick / scale().max) * 100">
          <span class="absolute -top-2 left-0 w-8 pr-1 text-right text-xs tabular-nums text-ink-soft">{{ tick }}</span>
        </div>
      }
      @if (goal() !== null && goalPosition() <= 100) {
        <div class="absolute inset-x-0 left-9 border-t border-ink" [style.bottom.%]="goalPosition()" aria-hidden="true"></div>
      }

      <div class="absolute inset-y-0 left-9 right-0 flex items-end" role="group" [attr.aria-label]="ariaLabel()" (keydown)="onKey($event)">
        @for (bar of bars(); track $index) {
          <button
            type="button"
            class="group flex h-full min-w-0 flex-1 items-end justify-center px-px focus-visible:outline-none"
            [tabindex]="$index === roving() ? 0 : -1"
            [attr.aria-label]="bar.readout"
            (pointerenter)="active.set($index)"
            (pointerleave)="active.set(null)"
            (focus)="active.set($index); roving.set($index)"
            (blur)="active.set(null)"
            (click)="active.set($index)"
          >
            <span
              class="block w-full max-w-6 rounded-t-[4px] transition-opacity group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-seal"
              [class]="barClass(bar.tone, $index)"
              [style.height.%]="(bar.value / scale().max) * 100"
              [style.min-height.px]="bar.value > 0 ? 2 : 0"
            ></span>
          </button>
        }
      </div>
    </div>

    <div class="relative mt-1 flex h-5 pl-9">
      <div class="flex flex-1">
        @for (bar of bars(); track $index) {
          <span class="relative min-w-0 flex-1">
            @if (labelled().has($index)) {
              <span class="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-ink-soft">{{ bar.label }}</span>
            }
          </span>
        }
      </div>
    </div>
  `,
})
export class BarChart {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly bars = input.required<readonly BarDatum[]>();
  /** Objectif (ligne de repère), ou `null`. */
  readonly goal = input<number | null>(null);
  readonly ariaLabel = input('Histogramme');
  readonly hint = input('Survole ou touche une barre pour voir le détail.');

  protected readonly active = signal<number | null>(null);
  /** Une seule barre est atteignable au clavier à la fois (Tab) ; les flèches parcourent les autres. */
  protected readonly roving = signal(0);

  protected readonly activeBar = computed(() => {
    const index = this.active();
    return index === null ? null : (this.bars()[index] ?? null);
  });
  protected readonly scale = computed(() =>
    niceScale(Math.max(0, ...this.bars().map((bar) => bar.value), this.goal() ?? 0)),
  );
  protected readonly goalPosition = computed(() => ((this.goal() ?? 0) / this.scale().max) * 100);
  protected readonly labelled = computed(() => labelIndices(this.bars().length));

  protected barClass(tone: BarDatum['tone'], index: number): string {
    const color = tone === 'good' ? 'bg-ok' : tone === 'muted' ? 'bg-ink-faint' : 'bg-ink-soft';
    const active = this.active();
    return `${color} ${active !== null && active !== index ? 'opacity-50' : ''}`;
  }

  protected onKey(event: KeyboardEvent): void {
    const last = this.bars().length - 1;
    const current = this.roving();
    const next =
      event.key === 'ArrowRight' ? Math.min(last, current + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, current - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    this.roving.set(next);
    queueMicrotask(() => this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role=group] button')[next]?.focus());
  }
}
