import { REVIEW_RATING, type ReviewMode } from '@kanadrill/shared';
import { buildChoices, buildMeaningChoices, buildReverseChoices } from './choices';
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
  it('note le QCM inversé comme un QCM (jamais Easy), plus large pour un kanji', () => {
    expect(gradeAnswer({ correct: false, mode: 'reverse', durationMs: 500 })).toBe(REVIEW_RATING.Again);
    expect(gradeAnswer({ correct: true, mode: 'reverse', durationMs: 500 })).toBe(REVIEW_RATING.Good);
    expect(gradeAnswer({ correct: true, mode: 'reverse', durationMs: SLOW_ANSWER_MS + 1 })).toBe(REVIEW_RATING.Hard); // kana
    expect(gradeAnswer({ correct: true, mode: 'reverse', durationMs: SLOW_ANSWER_MS + 1, kanji: true })).toBe(REVIEW_RATING.Good);
    expect(gradeAnswer({ correct: true, mode: 'reverse', durationMs: SLOW_MEANING_MS + 1, kanji: true })).toBe(REVIEW_RATING.Hard);
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
  it('propose le QCM inversé aux deux familles (un kanji se retrouve par son sens)', () => {
    expect(modesFor(['reverse'], kana)).toEqual(['reverse']);
    expect(modesFor(['reverse'], kanji)).toEqual(['reverse']);
    expect(modesFor(['reverse', 'choice'], kana)).toEqual(['reverse', 'choice']);
    expect(modesFor(['reverse'], { ...kanji, hasMeanings: false })).toEqual(['meaning']); // rien à afficher : repli
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

describe('buildReverseChoices', () => {
  const kana = (character: string, ...readings: string[]) => ({ character, readings, meanings: [] as string[] });
  const kanji = (character: string, ...meanings: string[]) => ({ character, readings: [] as string[], meanings });
  const hiragana = [kana('あ', 'a'), kana('い', 'i'), kana('う', 'u'), kana('え', 'e'), kana('お', 'o'), kana('を', 'wo', 'o'), kana('し', 'shi', 'si')];

  it('kana : le bon caractère et 3 leurres distincts', () => {
    const choices = buildReverseChoices(kana('か', 'ka'), 'reading', [hiragana]);
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain('か');
  });

  it('kana : écarte un leurre qui se lit aussi comme la lecture affichée (お et を)', () => {
    for (let i = 0; i < 50; i++) {
      expect(buildReverseChoices(kana('お', 'o'), 'reading', [hiragana])).not.toContain('を');
      expect(buildReverseChoices(kana('を', 'wo', 'o'), 'reading', [hiragana])).not.toContain('お');
    }
  });

  it('kanji : écarte un leurre qui partage un sens, sans tenir compte de la casse', () => {
    const pool = [kanji('月', 'lune', 'mois'), kanji('火', 'feu'), kanji('水', 'eau'), kanji('木', 'arbre'), kanji('曜', 'Jour', 'éclat')];
    for (let i = 0; i < 50; i++) {
      const choices = buildReverseChoices(kanji('日', 'jour', 'soleil'), 'meaning', [pool]);
      expect(choices).toContain('日');
      expect(choices).not.toContain('曜');
    }
  });

  it('prend les leurres du premier lot d\'abord (même niveau), puis du suivant', () => {
    const near = [kanji('一', 'un'), kanji('二', 'deux')];
    const far = [kanji('龍', 'dragon'), kanji('鷹', 'faucon'), kanji('鯨', 'baleine')];
    for (let i = 0; i < 30; i++) {
      const choices = buildReverseChoices(kanji('日', 'jour'), 'meaning', [near, far]);
      expect(choices).toEqual(expect.arrayContaining(['日', '一', '二']));
      expect(choices).toHaveLength(4);
    }
  });

  it('se contente des leurres disponibles et ne propose jamais deux fois le même caractère', () => {
    const choices = buildReverseChoices(kana('か', 'ka'), 'reading', [[kana('か', 'ka'), kana('き', 'ki')], [kana('き', 'ki')]]);
    expect(choices.sort()).toEqual(['か', 'き']);
  });
});
