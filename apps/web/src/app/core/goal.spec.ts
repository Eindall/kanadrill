import { goalProgress } from './goal';

describe('goalProgress', () => {
  it('calcule le pourcentage', () => {
    expect(goalProgress(0, 30)).toBe(0);
    expect(goalProgress(15, 30)).toBe(50);
    expect(goalProgress(10, 30)).toBe(33);
  });
  it('plafonne à 100 quand l\'objectif est dépassé', () => {
    expect(goalProgress(30, 30)).toBe(100);
    expect(goalProgress(75, 30)).toBe(100);
  });
  it('ne divise pas par zéro', () => {
    expect(goalProgress(5, 0)).toBe(0);
  });
});
