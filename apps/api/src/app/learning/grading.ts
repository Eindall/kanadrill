import { REVIEW_RATING, type ReviewMode, type ReviewRating } from '@kanadrill/shared';

/** Au-delà, une bonne réponse trahit une hésitation : note Hard. */
export const SLOW_ANSWER_MS = 8_000;
/** En saisie (rappel actif), une bonne réponse plus rapide que ça est notée Easy. */
export const FAST_TYPING_MS = 2_500;

/**
 * Déduit la note FSRS de la réponse : l'utilisateur ne choisit pas sa note.
 * Faux → Again ; juste → Good, Hard si lent, Easy si rapide et saisie (jamais Easy au QCM : on peut deviner).
 */
export function gradeAnswer(input: { correct: boolean; mode: ReviewMode; durationMs: number }): ReviewRating {
  if (!input.correct) return REVIEW_RATING.Again;
  if (input.durationMs > SLOW_ANSWER_MS) return REVIEW_RATING.Hard;
  if (input.mode === 'typing' && input.durationMs < FAST_TYPING_MS) return REVIEW_RATING.Easy;
  return REVIEW_RATING.Good;
}
