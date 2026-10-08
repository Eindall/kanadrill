import { Component, computed, input } from '@angular/core';
import type { MasteryCounts, MasteryLevel } from '@kanadrill/shared';

export interface MasteryRow {
  label: string;
  counts: MasteryCounts;
}

/** Du plus récent au plus solide : une seule teinte qui s'assombrit (validée en rampe ordinale) ; « pas encore vu » est le fond vide. */
const SEGMENTS: ReadonlyArray<{ level: MasteryLevel; label: string; color: string }> = [
  { level: 'mastered', label: 'Solides', color: 'var(--mastery-mastered)' },
  { level: 'known', label: 'Connus', color: 'var(--mastery-known)' },
  { level: 'learning', label: 'En cours', color: 'var(--mastery-learning)' },
  { level: 'unseen', label: 'Pas encore vus', color: 'var(--color-line)' },
];

/**
 * Maîtrise : une barre empilée par groupe, du plus solide au pas encore vu, séparée par un jour de 2 px (la séparation
 * est du vide, pas un contour). Les chiffres sont toujours lisibles à droite ; la légende nomme les quatre niveaux.
 */
@Component({
  selector: 'app-mastery-chart',
  template: `
    <ul class="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft" aria-label="Légende">
      @for (segment of segments; track segment.level) {
        <li class="inline-flex items-center gap-1.5">
          <span class="size-3" [style.background]="segment.color" [class.border]="segment.level === 'unseen'" [class.border-line]="segment.level === 'unseen'"></span>
          {{ segment.label }}
        </li>
      }
    </ul>

    <ul class="flex flex-col gap-3">
      @for (row of view(); track row.label) {
        <li class="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[7rem_1fr]">
          <span class="text-sm">{{ row.label }}</span>
          <div class="flex min-w-0 flex-col gap-1">
            <div class="flex h-4 gap-0.5" role="img" [attr.aria-label]="row.description">
              @for (part of row.parts; track part.level) {
                @if (part.count > 0) {
                  <span [style.flex-grow]="part.count" [style.background]="part.color" class="min-w-0.5 basis-0" [class.rounded-l-sm]="$first" [class.rounded-r-sm]="$last"></span>
                }
              }
            </div>
            <span class="text-xs tabular-nums text-ink-soft">
              {{ row.counts.mastered }} solides · {{ row.counts.known }} connus · {{ row.counts.learning }} en cours · {{ row.counts.unseen }} pas encore vus
            </span>
          </div>
        </li>
      }
    </ul>
  `,
})
export class MasteryChart {
  readonly rows = input.required<readonly MasteryRow[]>();
  protected readonly segments = SEGMENTS;

  protected readonly view = computed(() =>
    this.rows().map((row) => ({
      ...row,
      parts: SEGMENTS.map((segment) => ({ ...segment, count: row.counts[segment.level] })),
      description: `${row.label} : ${row.counts.mastered} solides, ${row.counts.known} connus, ${row.counts.learning} en cours, ${row.counts.unseen} pas encore vus`,
    })),
  );
}
