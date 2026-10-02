import { CARD_STATE, type CardState, type MasteryLevel } from '@kanadrill/shared';

/** Au-delà de cette stabilité FSRS (en jours : durée au bout de laquelle le souvenir tombe à 90 %), la carte est « solide ». */
export const MASTERED_STABILITY_DAYS = 21;

interface MasteryInput {
  state: CardState;
  reps: number;
  stability: number;
}

/**
 * Maîtrise d'un élément pour un utilisateur, déduite de l'état FSRS :
 * jamais répondu → `unseen` ; encore en (ré)apprentissage → `learning` ;
 * en révision → `known`, puis `mastered` quand la stabilité atteint {@link MASTERED_STABILITY_DAYS} jours.
 */
export function masteryLevel(userItem: MasteryInput | null | undefined): MasteryLevel {
  if (!userItem || userItem.reps === 0) return 'unseen';
  if (userItem.state !== CARD_STATE.Review) return 'learning';
  return userItem.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'known';
}
