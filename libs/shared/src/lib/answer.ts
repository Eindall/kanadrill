import { DRAWING_ANSWERS, type ReviewMode } from './learning';
import { isRomajiCorrect } from './romaji';

/**
 * Une réponse est-elle juste ? Romaji comparé aux lectures acceptées (QCM, saisie) ; au tracé, c'est
 * l'auto-évaluation de l'utilisateur qui fait foi. Partagée par l'API (qui note) et le front (retour immédiat).
 */
export function isAnswerCorrect(mode: ReviewMode, answer: string, readings: readonly string[]): boolean {
  if (mode === 'drawing') return answer === DRAWING_ANSWERS.correct;
  return isRomajiCorrect(answer, readings);
}
