import {
  DEFAULT_SESSION_SIZE,
  KANA_MODES,
  KANA_TYPES,
  KANJI_MODES,
  REVIEW_MODES,
  SESSION_SIZES,
  SESSION_TYPES,
  type ItemType,
  type ReviewMode,
  type SessionConfig,
  type SessionSize,
} from '@kanadrill/shared';

export const MODE_LABELS: Record<ReviewMode, string> = {
  choice: 'QCM de lecture',
  typing: 'Saisie de la lecture',
  meaning: 'Sens (QCM)',
  reading: 'Lecture (romaji ou kana)',
  drawing: 'Tracé au doigt',
  reverse: 'QCM inversé',
  kanjiReverse: 'QCM inversé',
};

/** Précision affichée sous un exercice : ce qu'on voit et ce qu'on doit trouver. */
export const MODE_HINTS: Partial<Record<ReviewMode, string>> = {
  reverse: 'On voit la lecture : retrouve le bon kana parmi quatre.',
  kanjiReverse: 'On voit le sens : retrouve le bon kanji parmi quatre.',
  drawing: 'Dessine le caractère, puis compare-le au modèle (kana et kanji cochés).',
};
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

const hasKana = (types: readonly ItemType[]): boolean => types.some((type) => KANA_TYPES.includes(type));
const hasKanji = (types: readonly ItemType[]): boolean => types.includes('kanji');

/**
 * Exercices cohérents avec les types cochés : on retire ceux qui ne servent à aucun type coché (la saisie de kana
 * sans kana, le sens de kanji sans kanji) et le tracé hors écran tactile, puis on ajoute l'exercice de base de
 * chaque famille cochée qui n'en aurait plus (QCM pour les kana, sens pour les kanji). L'ordre est celui de
 * `REVIEW_MODES`. Le tracé vaut pour les deux familles.
 */
export function reconcileModes(types: readonly ItemType[], modes: readonly ReviewMode[], touch: boolean): ReviewMode[] {
  const kana = hasKana(types);
  const kanji = hasKanji(types);
  const wanted = new Set(
    modes.filter(
      (mode) =>
        availableModes(touch).includes(mode) &&
        ((kana && KANA_MODES.includes(mode)) || (kanji && KANJI_MODES.includes(mode))),
    ),
  );
  if (kana && !KANA_MODES.some((mode) => wanted.has(mode))) wanted.add('choice');
  if (kanji && !KANJI_MODES.some((mode) => wanted.has(mode))) wanted.add('meaning');
  return REVIEW_MODES.filter((mode) => wanted.has(mode));
}

/** Familles cochées auxquelles il ne reste aucun exercice (le tracé compte pour les deux). */
export function familiesWithoutMode(types: readonly ItemType[], modes: readonly ReviewMode[]): Array<'kana' | 'kanji'> {
  const missing: Array<'kana' | 'kanji'> = [];
  if (hasKana(types) && !modes.some((mode) => KANA_MODES.includes(mode))) missing.push('kana');
  if (hasKanji(types) && !modes.some((mode) => KANJI_MODES.includes(mode))) missing.push('kanji');
  return missing;
}

/** Adapte un réglage (mémorisé, donc possiblement d'un autre usage ou d'un autre appareil) à l'appareil. */
export function adaptToDevice(config: SessionConfig, touch: boolean): SessionConfig {
  return { ...config, modes: reconcileModes(config.types, config.modes, touch) };
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
