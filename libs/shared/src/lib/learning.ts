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

/** Niveaux du JLPT (listes de Jonathan Waller) ; les kanji hors de ces listes forment la catégorie « autres ». */
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];
export type KanjiLevel = JlptLevel | 'other';
export const KANJI_LEVELS: readonly KanjiLevel[] = [...JLPT_LEVELS, 'other'];

/** Lectures d'un kanji telles que KANJIDIC2 les note : on en katakana, kun en hiragana (« ひ.く », « -び »). */
export interface KanjiReadings {
  on: string[];
  kun: string[];
}

export interface ItemDto {
  id: string;
  type: ItemType;
  character: string;
  /**
   * Romaji acceptés en saisie. Kana : le premier est la lecture de référence (à afficher). Kanji : toutes les
   * lectures on et kun, avec ou sans okurigana (vide si le kanji n'a pas de lecture).
   */
  readings: string[];
  /** Sens, en français quand KANJIDIC2 en a, sinon en anglais (vide pour les kana). */
  meanings: string[];
  /** Kanji uniquement : lectures à afficher (kana). */
  kanji?: KanjiReadings;
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
  /** Lecture de référence (romaji ; vide pour un kanji sans lecture). */
  reading: string;
  /** Groupe de kana ; `null` pour un kanji. */
  group: KanaGroup | null;
  mastery: MasteryLevel;
}

/** Ce que la fiche d'un kanji ajoute à celle d'un kana. */
export interface KanjiDetailDto extends KanjiReadings {
  /** `null` : hors des listes JLPT. */
  jlpt: JlptLevel | null;
  /** Niveau scolaire japonais (1 à 6 : kyōiku ; 8 : autres jōyō ; 9 et 10 : jinmeiyō), s'il y en a un. */
  grade: number | null;
  /** Rang de fréquence (1 = le plus courant), s'il est connu. */
  frequency: number | null;
  strokeCount: number | null;
  /** Langue des sens : français quand KANJIDIC2 en a, sinon anglais. */
  language: 'fr' | 'en';
  /** Dans le dictionnaire perso de l'utilisateur. */
  inDictionary: boolean;
}

/** Fiche détail d'un élément. */
export interface ItemDetailDto extends CatalogItemDto {
  /** Tous les romaji acceptés. */
  readings: string[];
  meanings: string[];
  /** Kanji uniquement. */
  kanji?: KanjiDetailDto;
  /** Traits dans l'ordre d'écriture (vide si KanjiVG ne couvre pas l'élément). */
  strokes: StrokeDto[];
  /** Nombre de réponses données et de ratés. */
  reps: number;
  lapses: number;
  /** Prochaine échéance (ISO 8601), `null` si jamais révisé. */
  nextDue: string | null;
}

/** Un kanji dans la liste du mode « Apprendre ». */
export interface KanjiListItemDto {
  id: string;
  character: string;
  /** Premier sens (français si KANJIDIC2 en a, sinon anglais). */
  meaning: string;
  jlpt: JlptLevel | null;
  /** Dans le dictionnaire perso de l'utilisateur (seuls ces kanji sont révisés). */
  inDictionary: boolean;
  /** `unseen` tant que le kanji n'est pas dans le dictionnaire ou n'a reçu aucune réponse. */
  mastery: MasteryLevel;
}

export interface KanjiPageDto {
  items: KanjiListItemDto[];
  /** Nombre de kanji correspondant à la recherche (au-delà de la page). */
  total: number;
}

export const KANJI_PAGE_SIZE = 100;
export const KANJI_MAX_PAGE_SIZE = 200;

/** Effectifs d'un niveau JLPT (ou de « autres »), pour l'utilisateur. */
export interface KanjiLevelSummaryDto {
  level: KanjiLevel;
  total: number;
  inDictionary: number;
}

/** Nombre maximal de kanji ajoutés d'un coup au dictionnaire. */
export const MAX_DICTIONARY_BATCH = 500;

/** Objectif quotidien (nombre de cartes à tenter par jour) : défaut et bornes, modifiable par utilisateur. */
export const DEFAULT_DAILY_GOAL = 30;
export const MIN_DAILY_GOAL = 1;
export const MAX_DAILY_GOAL = 500;

/** Tailles de session proposées. */
export const SESSION_SIZES = [15, 30, 50] as const;
export type SessionSize = (typeof SESSION_SIZES)[number];
export const DEFAULT_SESSION_SIZE: SessionSize = 30;

/** Types que l'on peut cocher pour une session (les kanji : ceux du dictionnaire perso). */
export const SESSION_TYPES: readonly ItemType[] = ['hiragana', 'katakana', 'kanji'];

/**
 * QCM (retrouver la lecture parmi des propositions), saisie libre du romaji, ou tracé : on voit la lecture, on
 * dessine le kana à la main, puis on s'auto-évalue face au modèle (le tracé n'est proposé que sur écran tactile).
 */
export type ReviewMode = 'choice' | 'typing' | 'drawing' | 'meaning' | 'reading' | 'reverse' | 'kanjiReverse';
export const REVIEW_MODES: readonly ReviewMode[] = ['choice', 'typing', 'drawing', 'meaning', 'reading', 'reverse', 'kanjiReverse'];

/**
 * Exercices propres à chaque famille : un kana se demande par sa lecture (QCM ou saisie), un kanji par son sens
 * (QCM) ou sa lecture (saisie en romaji ou en kana) ; le tracé vaut pour les deux. Chaque famille a aussi son QCM
 * inversé, activable séparément : on voit la lecture d'un kana (`reverse`) ou le sens d'un kanji (`kanjiReverse`) et
 * on retrouve le caractère parmi quatre.
 */
export const KANA_MODES: readonly ReviewMode[] = ['choice', 'typing', 'drawing', 'reverse'];
export const KANJI_MODES: readonly ReviewMode[] = ['meaning', 'reading', 'drawing', 'kanjiReverse'];
/** Les QCM inversés : la réponse est le caractère choisi. */
export const isReverseMode = (mode: ReviewMode): boolean => mode === 'reverse' || mode === 'kanjiReverse';
export const isKanjiType = (type: ItemType): boolean => type === 'kanji';
export const modesOfType = (type: ItemType): readonly ReviewMode[] => (isKanjiType(type) ? KANJI_MODES : KANA_MODES);

/**
 * Au tracé, la « réponse » envoyée est le verdict : celui que l'app propose après comparaison avec le modèle,
 * éventuellement corrigé par l'utilisateur. `fair` = juste mais approximatif (compté juste, noté Hard).
 */
export const DRAWING_ANSWERS = { correct: 'correct', fair: 'fair', wrong: 'wrong' } as const;

/** Durée maximale prise en compte pour une réponse (au-delà, on plafonne : onglet laissé ouvert). */
export const MAX_REVIEW_DURATION_MS = 120_000;

export interface SessionCardDto {
  item: ItemDto;
  mode: ReviewMode;
  /**
   * Propositions du QCM (la bonne réponse y figure) : lectures (`choice`), sens (`meaning`) ou caractères (`reverse`).
   */
  choices?: string[];
  /** Modèle du tracé (ordre des traits), uniquement si `mode` vaut `drawing`. */
  strokes?: StrokeDto[];
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
  /** Romaji saisi, proposition choisie au QCM (le caractère choisi, à l'envers), ou verdict du tracé (`DRAWING_ANSWERS`). */
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
