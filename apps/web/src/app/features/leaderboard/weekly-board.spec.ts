import { WEEKLY_TEXTS } from './weekly-board';

describe('textes des classements de la semaine', () => {
  it('accorde les unités au singulier et au pluriel', () => {
    expect(WEEKLY_TEXTS.answers.unit(1)).toBe('1 réponse');
    expect(WEEKLY_TEXTS.answers.unit(12)).toBe('12 réponses');
    expect(WEEKLY_TEXTS.drawing.unit(1)).toBe('1 pt');
    expect(WEEKLY_TEXTS.drawing.unit(160)).toBe('160 pts');
    expect(WEEKLY_TEXTS.drawing.detail(1)).toBe('1 tracé');
    expect(WEEKLY_TEXTS.drawing.detail(3)).toBe('3 tracés');
    expect(WEEKLY_TEXTS.answers.detail(67)).toBe('67 % de réussite');
  });
});
