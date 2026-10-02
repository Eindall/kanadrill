import { DRAWING_ANSWERS, type ReviewMode } from './learning';
import { isRomajiCorrect } from './romaji';

/**
 * Une réponse est-elle juste ? Romaji comparé aux lectures acceptées (QCM, saisie) ; au tracé, c'est
 * le verdict (proposé par la comparaison, corrigeable par l'utilisateur) qui fait foi. Partagée par l'API (qui note) et le front (retour immédiat).
 */
export function isAnswerCorrect(mode: ReviewMode, answer: string, readings: readonly string[]): boolean {
  if (mode === 'drawing') return answer === DRAWING_ANSWERS.correct || answer === DRAWING_ANSWERS.fair;
  return isRomajiCorrect(answer, readings);
}
