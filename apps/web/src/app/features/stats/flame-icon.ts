import { Component } from '@angular/core';

/** Flamme de la série (décorative : le nombre de jours est toujours écrit à côté). */
@Component({
  selector: 'app-flame-icon',
  template: `
    <svg viewBox="0 0 24 24" class="size-full" fill="currentColor" aria-hidden="true">
      <path d="M12.5 2.5c.6 3-1.8 4.6-1.8 7.4 0 1.1.7 1.9 1.7 1.9 1.4 0 2.3-1.1 2.4-2.8 2.2 1.6 3.6 4 3.6 6.5A6.4 6.4 0 0 1 12 21.8a6.4 6.4 0 0 1-6.4-6.4c0-2.2 1-4 2.6-5.6.1 1.4.7 2.3 1.7 2.8-.5-3.4.9-6.3 2.6-10.1z" />
    </svg>
  `,
  host: { class: 'inline-block' },
})
export class FlameIcon {}
