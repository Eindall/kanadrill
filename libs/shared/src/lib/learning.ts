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

/** Les types qui sont des kana (ils sont d'office dans le dictionnaire de chacun). */
export const KANA_TYPES: readonly ItemType[] = ['hiragana', 'katakana'];

/** Groupes de kana, dans l'ordre d'apprentissage : base, dakuten / handakuten, yōon. */
export const KANA_GROUPS = ['base', 'voiced', 'yoon'] as const;
export type KanaGroup = (typeof KANA_GROUPS)[number];

/** Un trait d'un tracé (KanjiVG, repère 109 × 109) : chemin SVG et position de son numéro. */
export interface StrokeDto {
  d: string;
  n: [x: number, y: number];
}

/** Niveau de maîtrise d'un élément pour un utilisateur : jamais vu, en cours, connu, solide. */
export const MASTERY_LEVELS = ['unseen', 'learning', 'known', 'mastered'] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

/** Un élément du catalogue du mode « Apprendre », avec la maîtrise de l'utilisateur. */
export interface CatalogItemDto {
  id: string;
  type: ItemType;
  character: string;
  /** Lecture de référence (romaji). */
  reading: string;
  /** Groupe de kana ; `null` pour un kanji. */
  group: KanaGroup | null;
  mastery: MasteryLevel;
}

/** Fiche détail d'un élément. */
export interface ItemDetailDto extends CatalogItemDto {
  /** Tous les romaji acceptés. */
  readings: string[];
  meanings: string[];
  /** Traits dans l'ordre d'écriture (vide si KanjiVG ne couvre pas l'élément). */
  strokes: StrokeDto[];
  /** Nombre de réponses données et de ratés. */
  reps: number;
  lapses: number;
  /** Prochaine échéance (ISO 8601), `null` si jamais révisé. */
  nextDue: string | null;
}

/** Objectif quotidien (nombre de cartes à tenter par jour) : défaut et bornes, modifiable par utilisateur. */
export const DEFAULT_DAILY_GOAL = 30;
export const MIN_DAILY_GOAL = 1;
export const MAX_DAILY_GOAL = 500;

/** Tailles de session proposées. */
export const SESSION_SIZES = [15, 30, 50] as const;
export type SessionSize = (typeof SESSION_SIZES)[number];
export const DEFAULT_SESSION_SIZE: SessionSize = 30;

/** Types que l'on peut cocher pour une session (« kanji » s'ajoutera avec le dictionnaire perso). */
export const SESSION_TYPES: readonly ItemType[] = ['hiragana', 'katakana'];

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

/** Réglage d'une session, choisi à chaque lancement. */
export interface SessionConfig {
  count: SessionSize;
  types: ItemType[];
  modes: ReviewMode[];
}

export interface ReviewSessionDto {
  cards: SessionCardDto[];
  /** D'où viennent les cartes : dues, jamais vues, ou déjà vues et reposées pour compléter. */
  counts: { due: number; new: number; extra: number };
}

/** Cartes disponibles pour un type d'item (ce que l'écran de réglage affiche). */
export interface TypeAvailability {
  total: number;
  due: number;
}

export interface ReviewOverviewDto {
  available: Partial<Record<ItemType, TypeAvailability>>;
  /** Réponses données aujourd'hui, réussies ou non. */
  answersToday: number;
  dailyGoal: number;
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
