import { pointsToPath, type Point } from './drawing-path';

describe('pointsToPath', () => {
  it('ne donne rien sans point', () => {
    expect(pointsToPath([])).toBe('');
  });

  it('dessine un point (tap) comme un trait de longueur nulle', () => {
    expect(pointsToPath([[10, 20]])).toBe('M10 20h0');
  });

  it('relie deux points par une droite', () => {
    expect(pointsToPath([[0, 0], [10, 5]])).toBe('M0 0L10 5');
  });

  it('lisse un trait : part du premier point, finit au dernier, courbes entre les milieux', () => {
    const points: Point[] = [[0, 0], [10, 0], [10, 10], [20, 10]];
    expect(pointsToPath(points)).toBe('M0 0L5 0Q10 0 10 5Q10 10 15 10L20 10');
  });

  it('arrondit les coordonnées au dixième', () => {
    expect(pointsToPath([[1.2345, 2.3456], [3.4567, 4.5678]])).toBe('M1.2 2.3L3.5 4.6');
  });
});
