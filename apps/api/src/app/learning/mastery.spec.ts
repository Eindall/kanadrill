import { CARD_STATE } from '@kanadrill/shared';
import { MASTERED_STABILITY_DAYS, masteryLevel } from './mastery';

describe('masteryLevel', () => {
  it('jamais vu : pas de carte, ou aucune réponse', () => {
    expect(masteryLevel(null)).toBe('unseen');
    expect(masteryLevel(undefined)).toBe('unseen');
    expect(masteryLevel({ state: CARD_STATE.New, reps: 0, stability: 0 })).toBe('unseen');
  });

  it('en cours : apprentissage et réapprentissage', () => {
    expect(masteryLevel({ state: CARD_STATE.Learning, reps: 1, stability: 0.4 })).toBe('learning');
    expect(masteryLevel({ state: CARD_STATE.Relearning, reps: 9, stability: 30 })).toBe('learning');
  });

  it('connu puis solide selon la stabilité', () => {
    expect(masteryLevel({ state: CARD_STATE.Review, reps: 3, stability: MASTERED_STABILITY_DAYS - 0.1 })).toBe('known');
    expect(masteryLevel({ state: CARD_STATE.Review, reps: 8, stability: MASTERED_STABILITY_DAYS })).toBe('mastered');
  });
});
