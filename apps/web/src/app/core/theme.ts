/** Thème de l'interface : constantes partagées avec `public/theme-init.js` (un test garde les deux alignés). */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'kanadrill-theme';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
/** Couleur de la barre d'état du navigateur (`<meta name="theme-color">`) : le fond de page de chaque thème. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#eef1f5', dark: '#0f1522' };

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}
