import { MAX_DRAWING_POINTS, MAX_DRAWING_STROKE_POINTS, type Point2D } from '@kanadrill/shared';

export type Point = Point2D;

/**
 * Allège un dessin avant de l'envoyer au serveur : on ne garde un point que s'il est à au moins `minGap` unités du
 * précédent gardé (le dernier point du trait est toujours gardé), et on arrondit au dixième. La forme est conservée
 * (la comparaison rééchantillonne chaque trait en 32 points). Si le dessin dépasse encore les limites de l'API
 * (tracé très appuyé, nombreux traits), l'écart minimum est augmenté jusqu'à y tenir.
 */
export function thinStrokes(strokes: readonly (readonly Point[])[], minGap = 1): Point[][] {
  const round = (n: number) => Math.round(n * 10) / 10;
  const thinned = strokes.map((stroke) => {
    const kept: Point[] = [];
    stroke.forEach((point, index) => {
      const previous = kept[kept.length - 1];
      const far = !previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= minGap;
      if (far || index === stroke.length - 1) kept.push([round(point[0]), round(point[1])]);
    });
    return kept;
  });
  const total = thinned.reduce((sum, stroke) => sum + stroke.length, 0);
  const fits = thinned.every((stroke) => stroke.length <= MAX_DRAWING_STROKE_POINTS) && total <= MAX_DRAWING_POINTS;
  return fits || minGap > 50 ? thinned : thinStrokes(strokes, minGap * 1.5);
}

const fmt = (value: number): string => String(Math.round(value * 10) / 10);
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * Chemin SVG lissé d'un trait : les points relevés sont les points de contrôle de courbes quadratiques entre
 * leurs milieux (le tracé passe donc au plus près sans les angles du relevé). Un point seul donne un point
 * (trait de longueur nulle, arrondi par `stroke-linecap: round`).
 */
export function pointsToPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  const [first] = points;
  if (points.length === 1) return `M${fmt(first[0])} ${fmt(first[1])}h0`;
  if (points.length === 2) return `M${fmt(first[0])} ${fmt(first[1])}L${fmt(points[1][0])} ${fmt(points[1][1])}`;

  let path = `M${fmt(first[0])} ${fmt(first[1])}`;
  const start = mid(first, points[1]);
  path += `L${fmt(start[0])} ${fmt(start[1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const end = mid(points[i], points[i + 1]);
    path += `Q${fmt(points[i][0])} ${fmt(points[i][1])} ${fmt(end[0])} ${fmt(end[1])}`;
  }
  const last = points[points.length - 1];
  return path + `L${fmt(last[0])} ${fmt(last[1])}`;
}
