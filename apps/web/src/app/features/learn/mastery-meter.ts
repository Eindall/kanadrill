import { Component, computed, input } from '@angular/core';
import type { MasteryLevel } from '@kanadrill/shared';
import { MASTERY_LABELS, MASTERY_STEPS } from './catalog-layout';

/** Trois segments (0 à 3 remplis) : la maîtrise se lit sans dépendre de la couleur, et reste dite aux lecteurs d'écran. */
@Component({
  selector: 'app-mastery-meter',
  template: `
    <span class="flex gap-0.5" role="img" [attr.aria-label]="label()">
      @for (step of steps; track step) {
        <span class="h-1 flex-1" [class]="step <= filled() ? 'bg-ink' : 'bg-line'"></span>
      }
    </span>
  `,
})
export class MasteryMeter {
  readonly level = input.required<MasteryLevel>();
  protected readonly steps = [1, 2, 3];
  protected readonly filled = computed(() => MASTERY_STEPS[this.level()]);
  protected readonly label = computed(() => MASTERY_LABELS[this.level()]);
}
