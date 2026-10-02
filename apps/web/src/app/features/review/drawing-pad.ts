import { Component, computed, input, model } from '@angular/core';
import { pointsToPath, type Point } from './drawing-path';

/** Côté du repère (celui de KanjiVG, pour que le tracé et le modèle se superposent et se comparent). */
const SIZE = 109;
/** Un point plus proche que ça du précédent n'est pas retenu (bruit du doigt). */
const MIN_STEP = 0.4;
const MAX_STROKES = 30;
const MAX_POINTS_PER_STROKE = 1500;

/**
 * Zone de tracé au doigt : un `<svg>` dans le repère 109 × 109, qui recueille les événements pointeur
 * (`touch-action: none` : le doigt dessine au lieu de faire défiler la page). Les traits sont des chemins SVG
 * lissés, donc nets à toute taille ; `locked` fige le dessin pour le comparer au modèle.
 */
@Component({
  selector: 'app-drawing-pad',
  template: `
    <div class="flex flex-col items-center gap-3">
      <svg
        #pad
        viewBox="0 0 109 109"
        class="aspect-square w-full max-w-xs touch-none select-none border border-line bg-paper"
        [class.cursor-crosshair]="!locked()"
        role="img"
        [attr.aria-label]="'Zone de tracé : ' + strokes().length + ' traits dessinés'"
        (pointerdown)="onDown($event, pad)"
        (pointermove)="onMove($event, pad)"
        (pointerup)="onUp($event, pad)"
        (pointercancel)="onUp($event, pad)"
      >
        <path d="M54.5 2V107M2 54.5H107" class="guide" />
        @for (d of paths(); track $index) {
          <path [attr.d]="d" class="stroke" [class.flagged]="flagged().includes($index)" />
        }
      </svg>

      @if (!locked()) {
        <div class="flex gap-3">
          <button
            type="button"
            (click)="undo()"
            [disabled]="strokes().length === 0"
            class="border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            Annuler le dernier trait
          </button>
          <button
            type="button"
            (click)="clear()"
            [disabled]="strokes().length === 0"
            class="border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            Effacer
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    path {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .guide {
      stroke: var(--color-line);
      stroke-width: 0.5;
      stroke-dasharray: 3 3;
    }
    .stroke {
      stroke: var(--color-ink);
      stroke-width: 3.5;
    }
    .stroke.flagged {
      stroke: var(--color-seal);
    }
  `,
})
export class DrawingPad {
  /** Les traits dessinés, chacun une suite de points dans le repère 109 × 109 (liaison bidirectionnelle). */
  readonly strokes = model<Point[][]>([]);
  readonly locked = input(false);
  /** Indices des traits à signaler (en rouge) : ceux que la comparaison a jugés fautifs. */
  readonly flagged = input<readonly number[]>([]);

  protected readonly paths = computed(() => this.strokes().map(pointsToPath));
  private drawing = false;

  protected onDown(event: PointerEvent, pad: Element): void {
    if (this.locked() || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (this.strokes().length >= MAX_STROKES) return;
    event.preventDefault();
    pad.setPointerCapture?.(event.pointerId);
    this.drawing = true;
    this.strokes.update((list) => [...list, [this.pointAt(event, pad)]]);
  }

  protected onMove(event: PointerEvent, pad: Element): void {
    if (!this.drawing || !event.isPrimary) return;
    event.preventDefault();
    // Sur écran tactile, les événements intermédiaires donnent un trait plus fidèle que le seul dernier point.
    const events = event.getCoalescedEvents?.() ?? [];
    const points = (events.length > 0 ? events : [event]).map((e) => this.pointAt(e, pad));
    this.strokes.update((list) => {
      const current = list[list.length - 1];
      if (!current || current.length >= MAX_POINTS_PER_STROKE) return list;
      const added = [...current];
      for (const point of points) {
        const last = added[added.length - 1];
        if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= MIN_STEP) added.push(point);
      }
      return added.length === current.length ? list : [...list.slice(0, -1), added];
    });
  }

  protected onUp(event: PointerEvent, pad: Element): void {
    if (!this.drawing) return;
    this.drawing = false;
    pad.releasePointerCapture?.(event.pointerId);
  }

  protected undo(): void {
    this.strokes.update((list) => list.slice(0, -1));
  }

  protected clear(): void {
    this.strokes.set([]);
  }

  /** Position du pointeur dans le repère du dessin, bornée à la zone (un doigt qui déborde ne sort pas du cadre). */
  private pointAt(event: PointerEvent, pad: Element): Point {
    const rect = pad.getBoundingClientRect();
    const clamp = (value: number) => Math.min(SIZE, Math.max(0, value));
    return [clamp(((event.clientX - rect.left) / rect.width) * SIZE), clamp(((event.clientY - rect.top) / rect.height) * SIZE)];
  }
}
