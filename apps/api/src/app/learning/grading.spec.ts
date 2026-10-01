import { REVIEW_RATING } from '@kanadrill/shared';
import { buildChoices } from './choices';
import { FAST_TYPING_MS, gradeAnswer, SLOW_ANSWER_MS } from './grading';

describe('gradeAnswer', () => {
  const grade = (correct: boolean, mode: 'choice' | 'typing', durationMs: number) =>
    gradeAnswer({ correct, mode, durationMs });

  it('note Again une mauvaise réponse, même rapide', () => {
    expect(grade(false, 'typing', 100)).toBe(REVIEW_RATING.Again);
    expect(grade(false, 'choice', 100)).toBe(REVIEW_RATING.Again);
  });
  it('note Good une bonne réponse normale', () => {
    expect(grade(true, 'choice', 3_000)).toBe(REVIEW_RATING.Good);
    expect(grade(true, 'typing', FAST_TYPING_MS)).toBe(REVIEW_RATING.Good);
  });
  it('note Hard une bonne réponse lente', () => {
    expect(grade(true, 'choice', SLOW_ANSWER_MS + 1)).toBe(REVIEW_RATING.Hard);
    expect(grade(true, 'typing', SLOW_ANSWER_MS + 1)).toBe(REVIEW_RATING.Hard);
  });
  it('ne note Easy qu\'une saisie rapide, jamais un QCM', () => {
    expect(grade(true, 'typing', FAST_TYPING_MS - 1)).toBe(REVIEW_RATING.Easy);
    expect(grade(true, 'choice', 500)).toBe(REVIEW_RATING.Good);
  });
});

describe('buildChoices', () => {
  const pool = [['a'], ['i'], ['u'], ['e'], ['o'], ['shi', 'si'], ['wo', 'o'], ['o']].map((readings) => ({ readings }));

  it('contient la bonne réponse et 4 propositions distinctes', () => {
    const choices = buildChoices({ readings: ['shi', 'si'] }, pool);
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain('shi');
  });

  it('écarte les leurres qui seraient aussi une réponse valable', () => {
    for (let i = 0; i < 50; i++) {
      // を accepte « o » : le leurre お (« o ») serait aussi une bonne réponse.
      expect(buildChoices({ readings: ['wo', 'o'] }, pool)).not.toContain('o');
      // お n'accepte pas « wo » : ce leurre reste légitime, mais « o » n'apparaît qu'une fois.
      expect(buildChoices({ readings: ['o'] }, pool).filter((c) => c === 'o')).toHaveLength(1);
    }
  });

  it('s\'adapte à un petit jeu de leurres', () => {
    const choices = buildChoices({ readings: ['a'] }, [{ readings: ['a'] }, { readings: ['i'] }]);
    expect(choices.sort()).toEqual(['a', 'i']);
  });
});
