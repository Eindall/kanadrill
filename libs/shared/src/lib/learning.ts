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
