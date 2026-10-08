import { pointsToPath, thinStrokes, type Point } from './drawing-path';

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

describe('thinStrokes', () => {
  it('garde les extrémités, écarte les points trop proches et arrondit au dixième', () => {
    const dense: Point[] = Array.from({ length: 101 }, (_, i) => [i * 0.1, 0.04 * i]);
    const [thin] = thinStrokes([dense]);
    expect(thin.length).toBeLessThan(15);
    expect(thin[0]).toEqual([0, 0]);
    expect(thin[thin.length - 1]).toEqual([10, 4]);
    expect(thin.every(([x, y]) => x === Math.round(x * 10) / 10 && y === Math.round(y * 10) / 10)).toBe(true);
  });

  it('garde un trait réduit à un point, et ne modifie pas son entrée', () => {
    const input: Point[][] = [[[3.14159, 2.71828]]];
    expect(thinStrokes(input)).toEqual([[[3.1, 2.7]]]);
    expect(input[0][0]).toEqual([3.14159, 2.71828]);
  });

  it('respecte les limites de l\'API pour un tracé très dense', () => {
    const wiggle: Point[] = Array.from({ length: 1500 }, (_, i) => [50 + 40 * Math.sin(i / 20), 50 + 40 * Math.cos(i / 31)]);
    expect(thinStrokes([wiggle])[0].length).toBeLessThanOrEqual(400);
  });
});
