import { Component, input, signal } from '@angular/core';
import type { StrokeDto } from '@kanadrill/shared';

/** Délai entre le début de deux traits consécutifs, en secondes (voir `--delay` dans le gabarit). */
const STROKE_DELAY_S = 0.9;

/**
 * Ordre des traits animé : les traits se dessinent un par un (technique du `stroke-dashoffset` avec
 * `pathLength="1"`), un fantôme gris montre le caractère entier. Le repère est celui de KanjiVG (109 × 109).
 * Avec `prefers-reduced-motion`, tous les traits apparaissent d'un coup (seuls les numéros donnent l'ordre).
 */
@Component({
  selector: 'app-stroke-order',
  template: `
    <div class="flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 109 109"
        class="aspect-square w-full max-w-xs border border-line bg-paper"
        role="img"
        [attr.aria-label]="'Ordre des traits : ' + strokes().length + ' traits'"
      >
        <!-- Repères de calligraphie -->
        <path d="M54.5 2V107M2 54.5H107" class="guide" />
        <g class="ghost">
          @for (stroke of strokes(); track $index) {
            <path [attr.d]="stroke.d" />
          }
        </g>
        @for (run of [runId()]; track run) {
          <g class="ink">
            @for (stroke of strokes(); track $index) {
              <path [attr.d]="stroke.d" pathLength="1" [style.--delay]="$index * delay + 's'" />
            }
          </g>
          @if (numbers()) {
            <g class="numbers">
              @for (stroke of strokes(); track $index) {
                <text [attr.x]="stroke.n[0]" [attr.y]="stroke.n[1]" [style.--delay]="$index * delay + 's'">{{ $index + 1 }}</text>
              }
            </g>
          }
        }
      </svg>

      <div class="flex flex-wrap justify-center gap-3">
        <button type="button" (click)="replay()" class="border border-ink px-5 py-2 font-medium hover:bg-ink hover:text-paper">
          Rejouer
        </button>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" class="size-4 accent-ink" [checked]="numbers()" (change)="numbers.set(!numbers())" />
          Numéros
        </label>
      </div>
    </div>
  `,
  styles: `
    path {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3;
    }
    .guide {
      stroke: var(--color-line);
      stroke-width: 0.5;
      stroke-dasharray: 3 3;
    }
    .ghost path {
      stroke: var(--color-line);
    }
    .ink path {
      stroke: var(--color-ink);
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: draw 0.7s ease-in-out var(--delay) forwards;
    }
    .numbers text {
      font-size: 7px;
      fill: var(--color-ink-soft);
      opacity: 0;
      animation: appear 0.01s linear var(--delay) forwards;
    }
    @keyframes draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes appear {
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ink path,
      .numbers text {
        animation-delay: 0s;
      }
    }
  `,
})
export class StrokeOrder {
  readonly strokes = input.required<StrokeDto[]>();

  protected readonly delay = STROKE_DELAY_S;
  protected readonly numbers = signal(true);
  /** Changer cette valeur recrée les traits : l'animation repart de zéro. */
  protected readonly runId = signal(0);

  protected replay(): void {
    this.runId.update((id) => id + 1);
  }
}
