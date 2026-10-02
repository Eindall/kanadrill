import { Component, computed, input, signal } from '@angular/core';
import { labelIndices } from './stats-helpers';

export interface LinePoint {
  label: string;
  readout: string;
  /** Pourcentage de 0 à 100, ou `null` (pas de réponse : la ligne s'interrompt). */
  value: number | null;
}

/**
 * Courbe d'un pourcentage (0 à 100) : un seul trait de 2 px, des points de 10 px au plus quand il n'y en a pas trop,
 * un repère vertical qui suit le survol (ou le toucher, ou le focus) et en affiche le détail dans la ligne de lecture.
 * Les périodes sans réponse interrompent la ligne au lieu de la faire plonger à 0 %.
 */
@Component({
  selector: 'app-line-chart',
  template: `
    <p class="mb-2 min-h-5 text-sm" aria-live="polite">
      @if (activePoint(); as point) {
        {{ point.readout }}
      } @else {
        <span class="text-ink-soft">{{ hint() }}</span>
      }
    </p>

    <div class="relative h-44 pl-9">
      @for (tick of ticks; track tick) {
        <div class="absolute inset-x-0 border-t border-line" [style.bottom.%]="tick">
          <span class="absolute -top-2 left-0 w-8 pr-1 text-right text-xs tabular-nums text-ink-soft">{{ tick }}&nbsp;%</span>
        </div>
      }

      <div class="absolute inset-y-0 left-9 right-0">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <path [attr.d]="path()" fill="none" stroke="var(--color-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        </svg>

        @if (active() !== null && activePoint()?.value !== null) {
          <span class="absolute inset-y-0 border-l border-ink-soft/40" [style.left.%]="x(active()!)"></span>
        }
        @for (point of points(); track $index) {
          @if (point.value !== null && (showDots() || $index === lastIndex() || $index === active())) {
            <span
              class="absolute -translate-x-1/2 translate-y-1/2 rounded-full bg-ink ring-2 ring-paper"
              [class]="$index === active() ? 'size-3.5' : 'size-2.5'"
              [style.left.%]="x($index)"
              [style.bottom.%]="point.value"
            ></span>
          }
        }

        <div class="absolute inset-0 flex" role="group" [attr.aria-label]="ariaLabel()">
          @for (point of points(); track $index) {
            <button
              type="button"
              class="h-full min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-seal"
              [attr.aria-label]="point.readout"
              (pointerenter)="active.set($index)"
              (pointerleave)="active.set(null)"
              (focus)="active.set($index)"
              (blur)="active.set(null)"
              (click)="active.set($index)"
            ></button>
          }
        </div>
      </div>
    </div>

    <div class="relative mt-1 flex h-5 pl-9">
      <div class="flex flex-1">
        @for (point of points(); track $index) {
          <span class="relative min-w-0 flex-1">
            @if (labelled().has($index)) {
              <span class="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-ink-soft">{{ point.label }}</span>
            }
          </span>
        }
      </div>
    </div>
  `,
})
export class LineChart {
  readonly points = input.required<readonly LinePoint[]>();
  readonly ariaLabel = input('Courbe');
  readonly hint = input('Survole ou touche la courbe pour voir le détail.');

  protected readonly ticks = [0, 50, 100];
  protected readonly active = signal<number | null>(null);

  protected readonly activePoint = computed(() => {
    const index = this.active();
    return index === null ? null : (this.points()[index] ?? null);
  });
  protected readonly lastIndex = computed(() => {
    const points = this.points();
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value !== null) return i;
    return -1;
  });
  /** Au-delà d'une trentaine de points, seuls le dernier et le point survolé sont marqués. */
  protected readonly showDots = computed(() => this.points().length <= 31);
  protected readonly labelled = computed(() => labelIndices(this.points().length));

  protected x(index: number): number {
    return ((index + 0.5) / this.points().length) * 100;
  }

  /** Une ligne par suite de jours avec réponses : un point isolé n'a que son marqueur. */
  protected readonly path = computed(() => {
    let d = '';
    let drawing = false;
    this.points().forEach((point, index) => {
      if (point.value === null) {
        drawing = false;
        return;
      }
      d += `${drawing ? 'L' : 'M'}${this.x(index).toFixed(2)} ${(100 - point.value).toFixed(2)}`;
      drawing = true;
    });
    return d;
  });
}
