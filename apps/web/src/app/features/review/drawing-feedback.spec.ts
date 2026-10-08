import type { DrawingScore } from '@kanadrill/shared';
import { describeScore, suggestedAnswer } from './drawing-feedback';

const score = (verdict: DrawingScore['verdict'], issues: DrawingScore['issues'] = []): DrawingScore => ({
  verdict,
  score: verdict === 'good' ? 95 : verdict === 'fair' ? 70 : 0,
  issues,
  flagged: [],
  distances: [],
});

describe('suggestedAnswer', () => {
  it('propose le verdict de la comparaison', () => {
    expect(suggestedAnswer(score('good'))).toBe('correct');
    expect(suggestedAnswer(score('fair'))).toBe('fair');
    expect(suggestedAnswer(score('wrong'))).toBe('wrong');
  });
});

describe('describeScore', () => {
  it('explique un tracé juste ou approximatif', () => {
    expect(describeScore(score('good'))[0]).toContain('corrects');
    expect(describeScore(score('fair'))[0]).toContain('approximatives');
  });

  it('ajoute les traits éloignés à un verdict « presque »', () => {
    const messages = describeScore(score('fair', [{ type: 'shape', stroke: 3 }]));
    expect(messages).toHaveLength(2);
    expect(messages[1]).toBe('Le trait 4 s\'éloigne du modèle.');
  });

  it('numérote les traits à partir de 1 et décrit chaque faute', () => {
    const messages = describeScore(
      score('wrong', [
        { type: 'order', stroke: 0 },
        { type: 'direction', stroke: 1 },
        { type: 'shape', stroke: 2 },
      ]),
    );
    expect(messages).toEqual([
      'Le trait 1 n\'est pas à sa place dans l\'ordre.',
      'Le trait 2 est tracé dans le mauvais sens.',
      'Le trait 3 s\'éloigne du modèle.',
    ]);
  });

  it('accorde le nombre de traits', () => {
    expect(describeScore(score('wrong', [{ type: 'strokeCount', expected: 3, actual: 1 }]))).toEqual([
      'Tu as tracé 1 trait, le modèle en compte 3.',
    ]);
    expect(describeScore(score('wrong', [{ type: 'strokeCount', expected: 2, actual: 5 }]))[0]).toContain('5 traits');
  });

  it('demande de dessiner plus grand', () => {
    expect(describeScore(score('wrong', [{ type: 'tooSmall' }]))[0]).toContain('plus grand');
  });
});
