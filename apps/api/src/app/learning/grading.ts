import { DRAWING_ANSWERS, REVIEW_RATING, type ReviewMode, type ReviewRating } from '@kanadrill/shared';

/** Au-delà, une bonne réponse trahit une hésitation : note Hard. */
export const SLOW_ANSWER_MS = 8_000;
/** En saisie (rappel actif), une bonne réponse plus rapide que ça est notée Easy. */
export const FAST_TYPING_MS = 2_500;
/** Un tracé prend du temps : on ne le juge « hésitant » qu'au-delà (durée jusqu'à l'affichage du modèle). */
export const SLOW_DRAWING_MS = 30_000;

/**
 * Déduit la note FSRS de la réponse : l'utilisateur ne choisit pas sa note.
 * Faux → Again ; juste → Good, Hard si lent, Easy si rapide et saisie (jamais Easy au QCM : on peut deviner).
 * Au tracé, jamais Easy non plus ; le seuil de lenteur est plus large, et un verdict « approximatif » donne Hard.
 */
export function gradeAnswer(input: { correct: boolean; mode: ReviewMode; durationMs: number; answer?: string }): ReviewRating {
  if (!input.correct) return REVIEW_RATING.Again;
  if (input.mode === 'drawing') {
    // « Approximatif » (juste mais imprécis) est un Hard, comme une bonne réponse hésitante.
    if (input.answer === DRAWING_ANSWERS.fair || input.durationMs > SLOW_DRAWING_MS) return REVIEW_RATING.Hard;
    return REVIEW_RATING.Good;
  }
  if (input.durationMs > SLOW_ANSWER_MS) return REVIEW_RATING.Hard;
  if (input.mode === 'typing' && input.durationMs < FAST_TYPING_MS) return REVIEW_RATING.Easy;
  return REVIEW_RATING.Good;
}
