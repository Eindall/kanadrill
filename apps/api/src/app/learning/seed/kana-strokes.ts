import type { StrokeDto } from '@kanadrill/shared';
import { KANA_GLYPHS } from './kana-glyphs.data';

/** Un trait (ou un couple de coordonnées) mis à l'échelle puis translaté. */
interface Placement {
  scale: number;
  x: number;
  y: number;
}

/** Yōon (きゃ…) : le kana en i, réduit, à gauche ; le petit ゃ / ゅ / ょ, plus petit encore, en bas à droite. */
const YOON_BASE: Placement = { scale: 0.68, x: -2, y: 4 };
const YOON_SMALL: Placement = { scale: 0.44, x: 62, y: 56 };

const round = (value: number): number => Math.round(value * 100) / 100;
const place = ({ scale, x, y }: Placement, px: number, py: number): [number, number] => [
  round(px * scale + x),
  round(py * scale + y),
];

/**
 * Applique une mise à l'échelle uniforme puis une translation à un chemin SVG. Les coordonnées absolues
 * (majuscules) sont mises à l'échelle et translatées, les relatives (minuscules) seulement mises à l'échelle.
 * Les arcs ne sont pas gérés (KanjiVG n'en utilise pas pour les kana) : ils lèvent une erreur.
 */
export function transformPath(d: string, placement: Placement): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const out: string[] = [];
  let command = '';
  let index = 0; // rang du nombre dans la commande courante
  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      if (/[Aa]/.test(token)) throw new Error('Arc SVG non géré');
      command = token;
      index = 0;
      out.push(token);
      continue;
    }
    const value = Number(token);
    const absolute = command === command.toUpperCase();
    // H / V n'ont qu'une coordonnée ; les autres commandes alternent x, y.
    const isX = command.toUpperCase() === 'H' ? true : command.toUpperCase() === 'V' ? false : index % 2 === 0;
    const offset = absolute ? (isX ? placement.x : placement.y) : 0;
    out.push((index === 0 ? '' : ',') + round(value * placement.scale + offset));
    index += 1;
  }
  return out.join('');
}

function placeStrokes(strokes: readonly StrokeDto[], placement: Placement): StrokeDto[] {
  return strokes.map((stroke) => ({
    d: transformPath(stroke.d, placement),
    n: place(placement, stroke.n[0], stroke.n[1]),
  }));
}

/**
 * Traits d'un kana : le glyphe KanjiVG tel quel pour un kana simple, ou la composition du kana et de son petit
 * ゃ / ゅ / ょ pour un yōon. Tableau vide si KanjiVG ne couvre pas un des caractères.
 */
export function kanaStrokes(character: string): StrokeDto[] {
  const chars = [...character];
  const glyphs = chars.map((char) => KANA_GLYPHS[char]);
  if (glyphs.some((glyph) => !glyph)) return [];
  if (chars.length === 1) return glyphs[0].map((stroke) => ({ d: stroke.d, n: [...stroke.n] }));
  if (chars.length === 2) {
    return [...placeStrokes(glyphs[0], YOON_BASE), ...placeStrokes(glyphs[1], YOON_SMALL)];
  }
  return [];
}
