import {
  DEFAULT_SESSION_SIZE,
  REVIEW_MODES,
  SESSION_SIZES,
  SESSION_TYPES,
  type ItemType,
  type ReviewMode,
  type SessionConfig,
  type SessionSize,
} from '@kanadrill/shared';

export const MODE_LABELS: Record<ReviewMode, string> = { choice: 'QCM', typing: 'Texte libre', drawing: 'Tracé au doigt' };
export const TYPE_LABELS: Record<ItemType, string> = { hiragana: 'Hiragana', katakana: 'Katakana', kanji: 'Kanji' };

const STORAGE_KEY = 'kanadrill.sessionConfig';

export const DEFAULT_CONFIG: SessionConfig = {
  count: DEFAULT_SESSION_SIZE,
  types: [...SESSION_TYPES],
  modes: ['choice'],
};

const split = (value: string | null): string[] => (value ?? '').split(',').filter(Boolean);
const isSize = (n: number): n is SessionSize => (SESSION_SIZES as readonly number[]).includes(n);

/** Réglage valide ou `null` (valeurs inconnues, doublons, liste vide). */
export function validateConfig(input: { count: unknown; types: readonly unknown[]; modes: readonly unknown[] }): SessionConfig | null {
  const count = Number(input.count);
  const types = input.types.filter((t): t is ItemType => (SESSION_TYPES as readonly unknown[]).includes(t));
  const modes = input.modes.filter((m): m is ReviewMode => (REVIEW_MODES as readonly unknown[]).includes(m));
  const clean = types.length === input.types.length && modes.length === input.modes.length;
  if (!isSize(count) || !clean || types.length === 0 || modes.length === 0) return null;
  return { count, types: [...new Set(types)], modes: [...new Set(modes)] };
}

/** Lit le réglage dans l'URL (`?count=30&types=hiragana,katakana&modes=choice,typing`). */
export function configFromParams(params: { get(name: string): string | null }): SessionConfig | null {
  return validateConfig({ count: params.get('count'), types: split(params.get('types')), modes: split(params.get('modes')) });
}

export function configToParams(config: SessionConfig): Record<string, string> {
  return { count: String(config.count), types: config.types.join(','), modes: config.modes.join(',') };
}

/** Exercices proposés sur cet appareil : le tracé est réservé aux écrans tactiles. */
export function availableModes(touch: boolean): readonly ReviewMode[] {
  return REVIEW_MODES.filter((mode) => touch || mode !== 'drawing');
}

/** Adapte un réglage (mémorisé, donc possiblement d'un autre usage) à l'appareil : sans tracé hors écran tactile. */
export function adaptToDevice(config: SessionConfig, touch: boolean): SessionConfig {
  const modes = config.modes.filter((mode) => availableModes(touch).includes(mode));
  return { ...config, modes: modes.length > 0 ? modes : ['choice'] };
}

/** Dernier réglage utilisé (par appareil), ou le réglage par défaut. */
export function loadSavedConfig(): SessionConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SessionConfig> | null;
    if (saved) return validateConfig({ count: saved.count, types: saved.types ?? [], modes: saved.modes ?? [] }) ?? DEFAULT_CONFIG;
  } catch {
    // stockage indisponible ou contenu illisible : réglage par défaut
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: SessionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // stockage indisponible : on ne mémorise simplement pas
  }
}
