/** Types d'éléments à apprendre. Ajouter ici pour en introduire un nouveau. */
export const ITEM_TYPES = ['hiragana', 'katakana', 'kanji'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/**
 * Notes de révision. Les valeurs sont celles de `Rating` dans ts-fsrs (vérifié par un test de l'API),
 * ce qui évite d'embarquer ts-fsrs côté front uniquement pour les nommer.
 */
export const REVIEW_RATING = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type ReviewRating = (typeof REVIEW_RATING)[keyof typeof REVIEW_RATING];

/** États d'une carte FSRS (mêmes valeurs que `State` dans ts-fsrs). */
export const CARD_STATE = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export type CardState = (typeof CARD_STATE)[keyof typeof CARD_STATE];

export interface ItemDto {
  id: string;
  type: ItemType;
  character: string;
  /** Romaji acceptés en saisie ; le premier est la lecture de référence (à afficher). */
  readings: string[];
  meanings: string[];
}

/** Limite quotidienne de nouvelles cartes : valeur par défaut et bornes (modifiable par utilisateur). */
export const DEFAULT_DAILY_NEW_LIMIT = 10;
export const MAX_DAILY_NEW_LIMIT = 100;

/** QCM (retrouver la lecture parmi des propositions) ou saisie libre du romaji. */
export type ReviewMode = 'choice' | 'typing';
export const REVIEW_MODES: readonly ReviewMode[] = ['choice', 'typing'];

/** Durée maximale prise en compte pour une réponse (au-delà, on plafonne : onglet laissé ouvert). */
export const MAX_REVIEW_DURATION_MS = 120_000;

export interface SessionCardDto {
  item: ItemDto;
  mode: ReviewMode;
  /** Propositions du QCM (la bonne réponse y figure), uniquement si `mode` vaut `choice`. */
  choices?: string[];
  /** Jamais vue par l'utilisateur. */
  isNew: boolean;
}

export interface ReviewSessionDto {
  cards: SessionCardDto[];
  counts: { due: number; new: number };
  dailyNewLimit: number;
}

export interface SubmitReviewRequest {
  itemId: string;
  mode: ReviewMode;
  /** Romaji saisi, ou proposition choisie au QCM. */
  answer: string;
  durationMs: number;
}

export interface ReviewResultDto {
  correct: boolean;
  /** Lecture de référence, à afficher en cas d'erreur. */
  expected: string;
  rating: ReviewRating;
  /** Prochaine échéance de la carte (ISO 8601) : une échéance proche = à reposer dans la session. */
  nextDue: string;
}
