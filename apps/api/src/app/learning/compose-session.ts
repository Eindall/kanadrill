import { CARD_STATE, isKanjiType, modesOfType, type ItemType, type ReviewMode } from '@kanadrill/shared';
import { shuffle } from './shuffle';

/** Une carte candidate pour une session : un item et l'état de l'utilisateur dessus (vierge s'il ne l'a jamais vu). */
export interface Candidate {
  state: number;
  due: Date | null;
  lastReview: Date | null;
  sortOrder: number;
}

/** `due` : à revoir maintenant ; `new` : jamais vue ; `extra` : déjà vue, reposée pour compléter la session. */
export type CardOrigin = 'due' | 'new' | 'extra';

export interface ComposedCard<T extends Candidate> {
  candidate: T;
  origin: CardOrigin;
}

const byTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? -Infinity) - (b?.getTime() ?? -Infinity);

/**
 * Compose une session de `count` cartes à partir de tous les candidats de la sélection :
 *   1. les cartes dues, les plus en retard d'abord ;
 *   2. les cartes jamais vues, **tirées au hasard** (elles sont toutes au même niveau : pas d'ordre fixe, et la
 *      sélection change d'une session à l'autre) ;
 *   3. les cartes déjà vues mais pas encore dues, la moins récemment vue d'abord ;
 *   4. si cela ne suffit pas, on **cycle** : on repasse sur la même liste en tours successifs.
 * Une carte n'est jamais posée deux fois de suite, sauf s'il n'y a qu'une seule carte.
 * Liste vide si la sélection est vide.
 */
export function composeSession<T extends Candidate>(
  candidates: readonly T[],
  count: number,
  now: Date,
  random: () => number = Math.random,
): ComposedCard<T>[] {
  const isDue = (c: T) => c.state !== CARD_STATE.New && c.due !== null && c.due <= now;
  const isNew = (c: T) => c.state === CARD_STATE.New;

  const due = candidates.filter(isDue).sort((a, b) => byTime(a.due, b.due));
  const fresh = shuffle(candidates.filter(isNew), random);
  const others = candidates
    .filter((c) => !isDue(c) && !isNew(c))
    .sort((a, b) => byTime(a.lastReview, b.lastReview) || a.sortOrder - b.sortOrder);

  const ordered: ComposedCard<T>[] = [
    ...due.map((candidate) => ({ candidate, origin: 'due' as const })),
    ...fresh.map((candidate) => ({ candidate, origin: 'new' as const })),
    ...others.map((candidate) => ({ candidate, origin: 'extra' as const })),
  ];
  if (ordered.length === 0) return [];

  return Array.from({ length: count }, (_, index): ComposedCard<T> => {
    const entry = ordered[index % ordered.length];
    // Dès le deuxième tour, c'est du complément, quelle que soit l'origine de la carte.
    return index < ordered.length ? entry : { candidate: entry.candidate, origin: 'extra' };
  });
}

/** Mode d'exercice d'une carte, tiré parmi ceux que l'utilisateur a cochés. */
export function pickMode<M>(modes: readonly M[], random: () => number = Math.random): M {
  return modes[Math.floor(random() * modes.length)];
}

/** Ce dont une carte dispose pour chaque exercice. */
export interface ModeSupport {
  type: ItemType;
  hasStrokes: boolean;
  hasReadings: boolean;
  hasMeanings: boolean;
}

/**
 * Les exercices possibles pour une carte parmi ceux cochés. Chaque famille a les siens (un kana : QCM, saisie,
 * tracé ; un kanji : sens, lecture, tracé) et chaque exercice exige sa donnée : un modèle de tracé, des lectures,
 * des sens. Si rien ne convient (ex. des kanji dans une session « QCM de kana » seul), la carte retombe sur
 * l'exercice de base de sa famille plutôt que d'être écartée.
 */
export function modesFor(modes: readonly ReviewMode[], card: ModeSupport): ReviewMode[] {
  const ofFamily = new Set(modesOfType(card.type));
  const possible = modes.filter((mode) => {
    if (!ofFamily.has(mode)) return false;
    if (mode === 'drawing') return card.hasStrokes;
    if (mode === 'reading') return card.hasReadings;
    if (mode === 'meaning') return card.hasMeanings;
    if (mode === 'kanjiReverse') return card.hasMeanings; // un kanji se retrouve par son sens
    return true;
  });
  return possible.length > 0 ? possible : [isKanjiType(card.type) ? 'meaning' : 'choice'];
}
