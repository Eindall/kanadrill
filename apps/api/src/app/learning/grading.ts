import { DRAWING_ANSWERS, REVIEW_RATING, type ReviewMode, type ReviewRating } from '@kanadrill/shared';

/** Au-delà, une bonne réponse trahit une hésitation : note Hard. */
export const SLOW_ANSWER_MS = 8_000;
/** En saisie (rappel actif), une bonne réponse plus rapide que ça est notée Easy. */
export const FAST_TYPING_MS = 2_500;
/** Un tracé prend du temps : on ne le juge « hésitant » qu'au-delà (durée jusqu'à l'affichage du modèle). */
export const SLOW_DRAWING_MS = 30_000;
/** Un kanji demande plus de réflexion qu'un kana : sens (QCM) et lecture (saisie) ont des seuils plus larges. */
export const SLOW_MEANING_MS = 12_000;
export const SLOW_READING_MS = 15_000;
export const FAST_READING_MS = 4_000;

/**
 * Déduit la note FSRS de la réponse : l'utilisateur ne choisit pas sa note.
 * Faux → Again ; juste → Good, Hard si lent, Easy si rapide et saisie (jamais Easy au QCM : on peut deviner).
 * Au tracé, jamais Easy non plus ; le seuil de lenteur est plus large, et un verdict « approximatif » donne Hard.
 */
export function gradeAnswer(input: {
  correct: boolean;
  mode: ReviewMode;
  durationMs: number;
  answer?: string;
}): ReviewRating {
  const { mode, durationMs } = input;
  if (!input.correct) return REVIEW_RATING.Again;
  switch (mode) {
    case 'drawing':
      // « Approximatif » (juste mais imprécis) est un Hard, comme une bonne réponse hésitante.
      return input.answer === DRAWING_ANSWERS.fair || durationMs > SLOW_DRAWING_MS ? REVIEW_RATING.Hard : REVIEW_RATING.Good;
    case 'meaning':
      return durationMs > SLOW_MEANING_MS ? REVIEW_RATING.Hard : REVIEW_RATING.Good;
    case 'kanjiReverse': // QCM : jamais Easy ; retrouver un kanji prend autant de temps que le sens
      return durationMs > SLOW_MEANING_MS ? REVIEW_RATING.Hard : REVIEW_RATING.Good;
    case 'reading':
      if (durationMs > SLOW_READING_MS) return REVIEW_RATING.Hard;
      return durationMs < FAST_READING_MS ? REVIEW_RATING.Easy : REVIEW_RATING.Good;
    case 'typing':
      if (durationMs > SLOW_ANSWER_MS) return REVIEW_RATING.Hard;
      return durationMs < FAST_TYPING_MS ? REVIEW_RATING.Easy : REVIEW_RATING.Good;
    default:
      return durationMs > SLOW_ANSWER_MS ? REVIEW_RATING.Hard : REVIEW_RATING.Good;
  }
}
