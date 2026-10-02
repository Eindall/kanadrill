export type Point2D = [x: number, y: number];

/**
 * Aplatit un chemin SVG en polyligne : les courbes de Bézier sont échantillonnées (`steps` segments chacune).
 * Gère M L H V C S Q Z, en absolu et en relatif ; les arcs (A) et les Q « lissés » (T) lèvent une erreur
 * (KanjiVG n'en utilise pas pour les kana). Les sous-chemins sont mis bout à bout.
 */
export function flattenPath(d: string, steps = 12): Point2D[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const points: Point2D[] = [];
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  /** Second point de contrôle de la dernière cubique (pour la réflexion du S). */
  let ctrl: Point2D | null = null;

  const next = (): number => {
    const token = tokens[index++];
    if (token === undefined || /[A-Za-z]/.test(token)) throw new Error('Chemin SVG invalide');
    return Number(token);
  };
  const line = (px: number, py: number) => {
    x = px;
    y = py;
    points.push([x, y]);
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, px: number, py: number) => {
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      points.push([
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * px,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * py,
      ]);
    }
    ctrl = [x2, y2];
    x = px;
    y = py;
  };

  while (index < tokens.length) {
    if (/[A-Za-z]/.test(tokens[index])) {
      command = tokens[index++];
    } else if (command === 'M') {
      command = 'L'; // paires suivantes d'un M : tracés droits
    } else if (command === 'm') {
      command = 'l';
    } else if (command === '') {
      throw new Error('Chemin SVG invalide');
    }

    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    const keepCtrl = command.toUpperCase() === 'C' || command.toUpperCase() === 'S';

    switch (command.toUpperCase()) {
      case 'M': {
        line(ox + next(), oy + next());
        startX = x;
        startY = y;
        break;
      }
      case 'L':
        line(ox + next(), oy + next());
        break;
      case 'H':
        line(ox + next(), y);
        break;
      case 'V':
        line(x, oy + next());
        break;
      case 'C':
        cubic(ox + next(), oy + next(), ox + next(), oy + next(), ox + next(), oy + next());
        break;
      case 'S': {
        const first: Point2D = ctrl ? [2 * x - ctrl[0], 2 * y - ctrl[1]] : [x, y];
        cubic(first[0], first[1], ox + next(), oy + next(), ox + next(), oy + next());
        break;
      }
      case 'Q': {
        const cx = ox + next();
        const cy = oy + next();
        const px = ox + next();
        const py = oy + next();
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          const u = 1 - t;
          points.push([u * u * x + 2 * u * t * cx + t * t * px, u * u * y + 2 * u * t * cy + t * t * py]);
        }
        x = px;
        y = py;
        break;
      }
      case 'Z':
        line(startX, startY);
        break;
      default:
        throw new Error(`Commande SVG non gérée : ${command}`);
    }
    if (!keepCtrl) ctrl = null;
  }
  return points;
}
