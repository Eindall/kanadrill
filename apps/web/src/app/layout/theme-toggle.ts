import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { ThemeService } from '../core/theme.service';
import type { ThemePreference } from '../core/theme';

/**
 * Sélecteur de thème : un bouton qui montre le choix courant (soleil, lune ou écran = système) et ouvre un petit menu
 * des trois choix. Un `<select>` natif ne peut pas afficher d'icônes. Menu à choix unique (`menuitemradio`), fermé par
 * Échap, par un clic à l'extérieur ou par le choix ; Échap rend le focus au bouton.
 */
@Component({
  selector: 'app-theme-toggle',
  template: `
    <div class="relative">
      <button
        type="button"
        #trigger
        (click)="open.set(!open())"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'Thème : ' + currentLabel()"
        class="flex size-9 items-center justify-center text-ink-soft hover:text-ink"
      >
        <ng-container [ngTemplateOutlet]="icon" [ngTemplateOutletContext]="{ $implicit: theme.preference() }" />
      </button>
      @if (open()) {
        <ul role="menu" aria-label="Thème" class="absolute right-0 z-10 mt-1 w-40 border border-line bg-paper py-1 shadow-lg">
          @for (option of options; track option.value) {
            <li role="none">
              <button
                type="button"
                role="menuitemradio"
                [attr.aria-checked]="theme.preference() === option.value"
                (click)="choose(option.value)"
                class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-snow"
                [class]="theme.preference() === option.value ? 'font-medium text-ink' : 'text-ink-soft'"
              >
                <ng-container [ngTemplateOutlet]="icon" [ngTemplateOutletContext]="{ $implicit: option.value }" />
                {{ option.label }}
              </button>
            </li>
          }
        </ul>
      }
    </div>

    <ng-template #icon let-value>
      <svg viewBox="0 0 24 24" class="size-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @switch (value) {
          @case ('light') {
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          }
          @case ('dark') {
            <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
          }
          @default {
            <rect x="3" y="4" width="18" height="12" rx="1.5" />
            <path d="M8 20h8M12 16v4" />
          }
        }
      </svg>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly open = signal(false);
  protected readonly options: ReadonlyArray<{ value: ThemePreference; label: string }> = [
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'system', label: 'Système' },
  ];
  protected readonly currentLabel = computed(() => this.options.find((o) => o.value === this.theme.preference())?.label ?? '');

  protected choose(value: ThemePreference): void {
    this.theme.set(value);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  protected onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.host.nativeElement.querySelector('button')?.focus();
  }
}
