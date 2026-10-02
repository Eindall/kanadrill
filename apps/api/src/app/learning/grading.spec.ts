import { REVIEW_RATING, type ReviewMode } from '@kanadrill/shared';
import { buildChoices, buildMeaningChoices } from './choices';
import { FAST_READING_MS, FAST_TYPING_MS, gradeAnswer, SLOW_ANSWER_MS, SLOW_DRAWING_MS, SLOW_MEANING_MS, SLOW_READING_MS } from './grading';
import { modesFor } from './compose-session';

describe('gradeAnswer', () => {
  const grade = (correct: boolean, mode: ReviewMode, durationMs: number, answer?: string) =>
    gradeAnswer({ correct, mode, durationMs, answer });

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
  it('note un tracé Again, Good, ou Hard seulement au-delà du seuil propre au tracé, jamais Easy', () => {
    expect(grade(false, 'drawing', 500)).toBe(REVIEW_RATING.Again);
    expect(grade(true, 'drawing', 500)).toBe(REVIEW_RATING.Good);
    expect(grade(true, 'drawing', SLOW_ANSWER_MS + 1)).toBe(REVIEW_RATING.Good); // lent pour une saisie, normal pour un tracé
    expect(grade(true, 'drawing', SLOW_DRAWING_MS + 1)).toBe(REVIEW_RATING.Hard);
  });
  it('note Hard un tracé approximatif, même rapide', () => {
    expect(grade(true, 'drawing', 500, 'fair')).toBe(REVIEW_RATING.Hard);
    expect(grade(true, 'drawing', 500, 'correct')).toBe(REVIEW_RATING.Good);
  });
  it('note un kanji avec des seuils plus larges : sens (QCM) et lecture (saisie)', () => {
    expect(grade(false, 'meaning', 500)).toBe(REVIEW_RATING.Again);
    expect(grade(true, 'meaning', SLOW_ANSWER_MS + 1)).toBe(REVIEW_RATING.Good); // lent pour un kana, normal pour un kanji
    expect(grade(true, 'meaning', SLOW_MEANING_MS + 1)).toBe(REVIEW_RATING.Hard);
    expect(grade(true, 'meaning', 500)).toBe(REVIEW_RATING.Good); // jamais Easy au QCM
    expect(grade(true, 'reading', FAST_READING_MS - 1)).toBe(REVIEW_RATING.Easy);
    expect(grade(true, 'reading', FAST_READING_MS)).toBe(REVIEW_RATING.Good);
    expect(grade(true, 'reading', SLOW_READING_MS + 1)).toBe(REVIEW_RATING.Hard);
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

describe('modesFor', () => {
  const kana = { type: 'hiragana', hasStrokes: true, hasReadings: true, hasMeanings: false } as const;
  const kanji = { type: 'kanji', hasStrokes: true, hasReadings: true, hasMeanings: true } as const;

  it('garde les exercices cochés qui conviennent à la famille de la carte', () => {
    expect(modesFor(['choice', 'drawing'], kana)).toEqual(['choice', 'drawing']);
    expect(modesFor(['choice', 'meaning', 'reading'], kana)).toEqual(['choice']); // sens et lecture de kanji : pas pour un kana
    expect(modesFor(['choice', 'typing', 'meaning', 'reading', 'drawing'], kanji)).toEqual(['meaning', 'reading', 'drawing']);
  });
  it('écarte le tracé pour une carte sans modèle, la lecture sans lecture, le sens sans sens', () => {
    expect(modesFor(['typing', 'drawing'], { ...kana, hasStrokes: false })).toEqual(['typing']);
    expect(modesFor(['meaning', 'reading', 'drawing'], { ...kanji, hasStrokes: false, hasReadings: false })).toEqual(['meaning']);
  });
  it('retombe sur l\'exercice de base de la famille si rien ne convient', () => {
    expect(modesFor(['drawing'], { ...kana, hasStrokes: false })).toEqual(['choice']);
    expect(modesFor(['choice', 'typing'], kanji)).toEqual(['meaning']); // session « QCM de kana » avec des kanji
    expect(modesFor(['drawing'], { ...kanji, hasStrokes: false })).toEqual(['meaning']);
  });
});

describe('buildMeaningChoices', () => {
  const pool = ['soleil', 'lune', 'feu', 'eau', 'arbre', 'jour'].map((meaning) => ({ meaning, language: 'fr' }));
  const english = ['sun', 'moon'].map((meaning) => ({ meaning, language: 'en' }));

  it('contient le premier sens et 3 leurres distincts de la même langue', () => {
    const choices = buildMeaningChoices({ meanings: ['montagne', 'mont'], language: 'fr' }, [...pool, ...english]);
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain('montagne');
    expect(choices.every((choice) => !['sun', 'moon'].includes(choice))).toBe(true);
  });
  it('écarte un leurre qui serait aussi un sens du kanji (sans tenir compte de la casse)', () => {
    for (let i = 0; i < 50; i++) {
      expect(buildMeaningChoices({ meanings: ['Jour', 'soleil'], language: 'fr' }, pool)).not.toEqual(
        expect.arrayContaining(['soleil', 'jour', 'jour']),
      );
      const choices = buildMeaningChoices({ meanings: ['Jour', 'soleil'], language: 'fr' }, pool);
      expect(choices.filter((choice) => ['soleil', 'jour'].includes(choice.toLowerCase()))).toEqual(['Jour']);
    }
  });
  it('se contente des leurres disponibles', () => {
    expect(buildMeaningChoices({ meanings: ['un'], language: 'fr' }, [{ meaning: 'deux', language: 'fr' }])).toHaveLength(2);
  });
});
