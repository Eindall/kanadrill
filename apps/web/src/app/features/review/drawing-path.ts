export type Point = [x: number, y: number];

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
