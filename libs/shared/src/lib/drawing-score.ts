import { flattenPath, type Point2D } from './svg-path';
import type { StrokeDto } from './learning';

/**
 * Réglages de la comparaison tracé / modèle. Les distances sont en unités du repère 109 × 109 de KanjiVG, après
 * recadrage du dessin sur le modèle. À ajuster avec de vrais tracés si le verdict paraît trop sévère ou trop clément.
 */
export const DRAWING_SCORE = {
  /** Points par trait après rééchantillonnage. */
  samples: 32,
  /** Écart moyen d'un trait jusqu'auquel il vaut 100 points. */
  perfectDistance: 6,
  /** Écart moyen d'un trait à partir duquel il vaut 0 point (entre les deux : décroissance linéaire). */
  zeroDistance: 30,
  /** Note /100 du tracé (moyenne des traits) à partir de laquelle il est « juste ». */
  goodScore: 88,
  /** Note /100 à partir de laquelle il est « presque » ; en dessous, « faux ». */
  fairScore: 60,
  /**
   * Un trait au-delà de cet écart est signalé (il s'éloigne du modèle) et, sert à reconnaître un trait qui en
   * ressemble à un autre (ordre) ou qui est inversé (sens). Il n'est plus une faute en soi : seule la note compte.
   */
  fairDistance: 15,
  /** Un trait n'est « hors d'ordre » ou « inversé » que s'il ressemble à cette part (ou moins) de son écart à sa propre place. */
  confusionRatio: 0.7,
  /** Un trait plus court ne permet pas de juger son sens (une inversion reste dans la tolérance). */
  minDirectionLength: 14,
  /** Le début d'un trait tracé à plus de cette distance du début du modèle, mais près de sa fin : sens inversé. */
  startTolerance: 22,
  /** Un dessin dont le plus grand côté est sous cette part de celui du modèle est jugé trop petit. */
  minSizeRatio: 0.25,
} as const;

export type DrawingVerdict = 'good' | 'fair' | 'wrong';

/** Ce qui ne va pas ; `stroke` est l'indice (à partir de 0) du trait de l'utilisateur concerné. */
export type DrawingIssue =
  | { type: 'strokeCount'; expected: number; actual: number }
  | { type: 'tooSmall' }
  | { type: 'order'; stroke: number }
  | { type: 'direction'; stroke: number }
  | { type: 'shape'; stroke: number };

export interface DrawingScore {
  /**
   * Tiré de `score` : `good` (≥ goodScore), `fair` (≥ fairScore), sinon `wrong`. Un nombre de traits différent, un
   * trait hors d'ordre ou inversé, ou un dessin trop petit valent 0 : toujours `wrong`.
   */
  verdict: DrawingVerdict;
  /** Précision du tracé, de 0 à 100 (0 si le nombre, l'ordre ou le sens des traits est faux). */
  score: number;
  /** Fautes structurelles (nombre, ordre, sens, taille) et traits qui s'éloignent du modèle (`shape`, informatif). */
  issues: DrawingIssue[];
  /** Traits de l'utilisateur à signaler sur le dessin (fautifs ou trop éloignés). */
  flagged: number[];
  /** Écart de chaque trait au modèle, rapporté à la tolérance (≤ goodDistance : juste). */
  distances: number[];
}

const dist = (a: Point2D, b: Point2D): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function polylineLength(points: readonly Point2D[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** `count` points régulièrement espacés le long de la polyligne (le premier et le dernier sont conservés). */
export function resample(points: readonly Point2D[], count: number = DRAWING_SCORE.samples): Point2D[] {
  if (points.length === 0) return [];
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + dist(points[i - 1], points[i]));
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return Array.from({ length: count }, () => [points[0][0], points[0][1]] as Point2D);

  const out: Point2D[] = [];
  let segment = 1;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (segment < cumulative.length - 1 && cumulative[segment] < target) segment++;
    const span = cumulative[segment] - cumulative[segment - 1];
    const t = span === 0 ? 0 : (target - cumulative[segment - 1]) / span;
    const a = points[segment - 1];
    const b = points[segment];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function boundingBox(points: readonly Point2D[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
}

/** Écart moyen entre deux traits rééchantillonnés au même nombre de points. */
const meanDistance = (a: readonly Point2D[], b: readonly Point2D[]): number =>
  a.reduce((sum, point, i) => sum + dist(point, b[i]), 0) / a.length;

/**
 * Compare le dessin de l'utilisateur au modèle (traits KanjiVG) et en tire un verdict.
 *
 * Le dessin est recadré sur le modèle (même centre, même plus grand côté : la taille et la position ne comptent
 * pas, pas les proportions). Puis chaque trait est comparé au trait de même rang du modèle, après
 * rééchantillonnage : écart moyen de forme, sens (début proche du début du modèle ou de sa fin) et, pour un trait
 * faux, ordre (il ressemble à un autre trait du modèle). Le nombre de traits doit être exactement celui du modèle.
 */
export function scoreDrawing(user: readonly (readonly Point2D[])[], model: readonly StrokeDto[]): DrawingScore {
  const wrong = (issues: DrawingIssue[]): DrawingScore => ({ verdict: 'wrong', score: 0, issues, flagged: [], distances: [] });
  if (user.length !== model.length || model.length === 0) {
    return wrong([{ type: 'strokeCount', expected: model.length, actual: user.length }]);
  }

  const modelLines = model.map((stroke) => flattenPath(stroke.d));
  const modelBox = boundingBox(modelLines.flat());
  const userBox = boundingBox(user.flat());
  const modelSize = Math.max(modelBox.width, modelBox.height);
  const userSize = Math.max(userBox.width, userBox.height);
  if (userSize < modelSize * DRAWING_SCORE.minSizeRatio) return wrong([{ type: 'tooSmall' }]);

  const scale = modelSize / userSize;
  const fit = (point: Point2D): Point2D => [
    modelBox.centerX + (point[0] - userBox.centerX) * scale,
    modelBox.centerY + (point[1] - userBox.centerY) * scale,
  ];

  const modelStrokes = modelLines.map((line) => resample(line));
  const userStrokes = user.map((stroke) => resample(stroke.map(fit)));
  // Tolérance proportionnelle à la taille du trait (un petit ゛ ou ゃ se juge plus finement), sans descendre trop bas.
  const tolerance = modelLines.map((line) => {
    const box = boundingBox(line);
    return Math.min(1, Math.max(0.6, Math.hypot(box.width, box.height) / 60));
  });
  const lengths = modelLines.map(polylineLength);

  const issues: DrawingIssue[] = [];
  const distances: number[] = [];
  const fair = DRAWING_SCORE.fairDistance;

  userStrokes.forEach((stroke, i) => {
    const target = modelStrokes[i];
    const forward = meanDistance(stroke, target) / tolerance[i];
    distances.push(forward);

    const reversed = [...stroke].reverse();
    const longEnough = lengths[i] >= DRAWING_SCORE.minDirectionLength;
    const reversedFit = meanDistance(reversed, target) / tolerance[i];
    const startsAtEnd =
      longEnough &&
      reversedFit < forward * DRAWING_SCORE.confusionRatio &&
      dist(stroke[0], target[0]) > DRAWING_SCORE.startTolerance * tolerance[i] &&
      dist(stroke[0], target[target.length - 1]) < dist(stroke[0], target[0]);

    if (startsAtEnd) {
      issues.push({ type: 'direction', stroke: i });
    } else if (forward > fair) {
      // Hors d'ordre ou inversé seulement si le trait ressemble CLAIREMENT mieux à un autre trait (ou au sien à
      // l'envers) qu'à sa place : un trait simplement brouillon n'est pas une faute d'ordre ni de sens.
      const clearly = (distance: number) => distance <= fair && distance <= forward * DRAWING_SCORE.confusionRatio;
      const resemblesAnother = modelStrokes.some((other, j) => j !== i && clearly(meanDistance(stroke, other) / tolerance[j]));
      if (resemblesAnother) issues.push({ type: 'order', stroke: i });
      else if (longEnough && clearly(reversedFit)) issues.push({ type: 'direction', stroke: i });
      else issues.push({ type: 'shape', stroke: i });
    }
  });

  const flagged = issues.flatMap((issue) => ('stroke' in issue ? [issue.stroke] : []));
  // Un trait mal placé dans l'ordre ou inversé vaut une note nulle pour tout le tracé.
  if (issues.some((issue) => issue.type === 'order' || issue.type === 'direction')) {
    return { verdict: 'wrong', score: 0, issues, flagged, distances };
  }
  // Sinon : la note est la moyenne de celle de chaque trait, selon son écart au modèle. Un trait très éloigné ne
  // condamne plus à lui seul le tracé (il pèse 1 / N), mais il est signalé.
  const { perfectDistance, zeroDistance, goodScore, fairScore } = DRAWING_SCORE;
  const strokeScore = (d: number) => Math.min(1, Math.max(0, (zeroDistance - d) / (zeroDistance - perfectDistance)));
  const score = Math.round((100 * distances.reduce((sum, d) => sum + strokeScore(d), 0)) / distances.length);
  // Un trait signalé comme éloigné du modèle empêche le « juste », même noyé dans un grand kanji.
  const verdict: DrawingVerdict =
    score >= goodScore && issues.length === 0 ? 'good' : score >= fairScore ? 'fair' : 'wrong';
  return { verdict, score, issues, flagged, distances };
}
