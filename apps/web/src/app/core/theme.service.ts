import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { THEME_COLORS, THEME_STORAGE_KEY, isThemePreference, type ResolvedTheme, type ThemePreference } from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Thème clair / sombre. La préférence (`system` par défaut) est mémorisée par appareil ; `system` suit le réglage
 * du système en direct. La classe `dark` sur `<html>` est posée une première fois avant le rendu par
 * `theme-init.js` (anti-flash), puis tenue à jour ici.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.(DARK_QUERY) ?? null;

  readonly preference = signal<ThemePreference>(this.load());
  private readonly systemDark = signal(this.media?.matches ?? false);
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    return preference === 'system' ? (this.systemDark() ? 'dark' : 'light') : preference;
  });

  constructor() {
    // Écouté en permanence : `resolved` ignore le système quand la préférence est explicite.
    this.media?.addEventListener?.('change', (event) => this.systemDark.set(event.matches));
    effect(() => {
      const theme = this.resolved();
      this.document.documentElement.classList.toggle('dark', theme === 'dark');
      this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    });
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // stockage indisponible : le choix vaut pour cette visite seulement
    }
  }

  /** Bascule du bouton de l'en-tête : l'inverse du thème affiché (la préférence devient explicite). */
  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private load(): ThemePreference {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(saved)) return saved;
    } catch {
      // stockage indisponible : système
    }
    return 'system';
  }
}
