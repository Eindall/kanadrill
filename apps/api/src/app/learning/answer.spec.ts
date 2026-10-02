import { displayMeanings, displayReadings, expectedAnswer, isAnswerCorrect, isReadingCorrect, type AnswerableItem } from '@kanadrill/shared';

const hi: AnswerableItem = {
  readings: ['nichi', 'jitsu', 'hi', 'bi', 'ka'],
  meanings: ['jour', 'soleil', 'Japon', 'compteur de jours'],
  kanji: { on: ['ニチ', 'ジツ'], kun: ['ひ', '-び', '-か'] },
};
const a: AnswerableItem = { readings: ['a'], meanings: [] };
const sa: AnswerableItem = { readings: ['shi', 'si'], meanings: [] };

describe('isAnswerCorrect', () => {
  it('kana : compare le romaji (QCM et saisie), avec les variantes', () => {
    expect(isAnswerCorrect('choice', 'a', a)).toBe(true);
    expect(isAnswerCorrect('typing', ' SI ', sa)).toBe(true);
    expect(isAnswerCorrect('typing', 'ka', a)).toBe(false);
  });

  it('sens d\'un kanji : un des sens, sans tenir compte de la casse ni des espaces', () => {
    expect(isAnswerCorrect('meaning', 'jour', hi)).toBe(true);
    expect(isAnswerCorrect('meaning', '  Soleil ', hi)).toBe(true);
    expect(isAnswerCorrect('meaning', 'japon', hi)).toBe(true);
    expect(isAnswerCorrect('meaning', 'lune', hi)).toBe(false);
    expect(isAnswerCorrect('meaning', '', hi)).toBe(false);
  });

  it('lecture d\'un kanji : romaji, hiragana ou katakana, on ou kun', () => {
    for (const answer of ['nichi', 'NICHI', 'にち', 'ニチ', 'jitsu', 'じつ', 'hi', 'ひ', 'bi', 'び', 'ka']) {
      expect([answer, isAnswerCorrect('reading', answer, hi)]).toEqual([answer, true]);
    }
    for (const answer of ['tsuki', 'つき', '', 'nic']) {
      expect([answer, isAnswerCorrect('reading', answer, hi)]).toEqual([answer, false]);
    }
  });

  it('lecture avec okurigana et voyelles longues', () => {
    const taberu: AnswerableItem = { readings: ['ta', 'taberu', 'shoku', 'jiki'], meanings: ['manger'] };
    expect(isReadingCorrect('たべる', taberu.readings)).toBe(true);
    expect(isReadingCorrect('taberu', taberu.readings)).toBe(true);
    expect(isReadingCorrect('しょく', taberu.readings)).toBe(true);
    expect(isReadingCorrect('sho', ['shou', 'sho'])).toBe(true); // ō sans la voyelle longue
    expect(isReadingCorrect('しょう', ['shou', 'sho'])).toBe(true);
  });

  it('tracé : le verdict fait foi', () => {
    expect(isAnswerCorrect('drawing', 'correct', hi)).toBe(true);
    expect(isAnswerCorrect('drawing', 'fair', hi)).toBe(true);
    expect(isAnswerCorrect('drawing', 'wrong', hi)).toBe(false);
    expect(isAnswerCorrect('drawing', 'nichi', hi)).toBe(false);
  });
});

describe('expectedAnswer', () => {
  it('donne la bonne réponse selon l\'exercice', () => {
    expect(expectedAnswer('choice', sa)).toBe('shi');
    expect(expectedAnswer('typing', a)).toBe('a');
    expect(expectedAnswer('meaning', hi)).toBe('jour, soleil, Japon');
    expect(expectedAnswer('reading', hi)).toBe('ニチ, ジツ, ひ, -び, -か');
    expect(expectedAnswer('drawing', hi)).toBe('jour, soleil, Japon'); // un kanji se dessine d'après son sens
    expect(expectedAnswer('drawing', sa)).toBe('shi'); // un kana, d'après sa lecture
  });
  it('limite les sens affichés, en nombre et en longueur, et tolère un kanji sans lecture', () => {
    expect(displayMeanings({ meanings: ['a', 'b', 'c', 'd'] }, 2)).toBe('a, b');
    const child = ['enfant', 'signe de la 1ère branche terrestre', 'signe du Rat (zodiaque)'];
    expect(displayMeanings({ meanings: child }, 3, 50)).toBe('enfant, signe de la 1ère branche terrestre'); // le 3e est trop long
    expect(displayMeanings({ meanings: child })).toBe('enfant'); // limite par défaut (40) : le 2e dépasse déjà
    expect(displayMeanings({ meanings: child }, 3, 5)).toBe('enfant'); // le premier est toujours gardé
    expect(displayMeanings({ meanings: ['un sens vraiment très très très long, bien plus que la limite'] }, 3, 10)).toContain('très');
    expect(displayReadings({ on: [], kun: [] })).toBe('');
    expect(expectedAnswer('reading', { readings: [], meanings: ['x'], kanji: { on: [], kun: [] } })).toBe('');
  });
});
