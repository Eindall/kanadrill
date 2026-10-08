import { ANSWER_POINTS, ANSWER_TIME_LIMIT_MS, answerPoints } from '@kanadrill/shared';

describe('answerPoints', () => {
  it('chill : un montant fixe, quel que soit le temps', () => {
    expect(answerPoints('choice', 100, false)).toBe(ANSWER_POINTS.chill);
    expect(answerPoints('reading', 90_000, false)).toBe(ANSWER_POINTS.chill);
  });

  it('chronométré : 120 tout de suite, 60 au temps limite, linéaire entre les deux, jamais en dessous', () => {
    for (const mode of Object.keys(ANSWER_TIME_LIMIT_MS) as Array<keyof typeof ANSWER_TIME_LIMIT_MS>) {
      const limit = ANSWER_TIME_LIMIT_MS[mode];
      expect(answerPoints(mode, 0, true)).toBe(120);
      expect(answerPoints(mode, limit / 2, true)).toBe(90);
      expect(answerPoints(mode, limit, true)).toBe(60);
      expect(answerPoints(mode, limit * 10, true)).toBe(60);
    }
  });

  it('le chill vaut moins que le meilleur chrono et plus que le plancher', () => {
    expect(ANSWER_POINTS.min).toBeLessThan(ANSWER_POINTS.chill);
    expect(ANSWER_POINTS.chill).toBeLessThan(ANSWER_POINTS.max);
  });
});
