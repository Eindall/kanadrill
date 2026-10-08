import type { ReviewMode } from './learning';

/**
 * Points d'une bonne réponse hors tracé (les tracés ont leur propre règle : précision × bonus, voir `drawing-score.ts`).
 * Même ordre de grandeur que le tracé : 60 à 120 points par bonne réponse, 0 pour une mauvaise.
 */
export const ANSWER_POINTS = {
  /** Session « chill » : pas de chrono, un montant fixe. */
  chill: 80,
  /** Session chronométrée : réponse immédiate. */
  max: 120,
  /** Session chronométrée : temps écoulé (ou au-delà) ; jamais en dessous tant que la réponse est juste. */
  min: 60,
} as const;

/**
 * Durée du chrono (en ms) par exercice : les points passent linéairement de `max` à `min` sur cette durée.
 * Alignée sur le seuil de lenteur de la notation FSRS (`grading.ts`) : le chrono s'arrête quand la réponse serait
 * jugée « hésitante ».
 */
export const ANSWER_TIME_LIMIT_MS: Record<Exclude<ReviewMode, 'drawing'>, number> = {
  choice: 8_000,
  reverse: 8_000,
  typing: 8_000,
  meaning: 12_000,
  kanjiReverse: 12_000,
  reading: 15_000,
};

/** Points d'une bonne réponse (hors tracé) selon le rythme de la session et le temps pris. */
export function answerPoints(mode: Exclude<ReviewMode, 'drawing'>, durationMs: number, timed: boolean): number {
  if (!timed) return ANSWER_POINTS.chill;
  const ratio = Math.min(1, Math.max(0, durationMs / ANSWER_TIME_LIMIT_MS[mode]));
  return Math.round(ANSWER_POINTS.max - (ANSWER_POINTS.max - ANSWER_POINTS.min) * ratio);
}
