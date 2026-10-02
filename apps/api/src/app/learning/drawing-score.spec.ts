import { DRAWING_SCORE, flattenPath, polylineLength, resample, scoreDrawing, type Point2D, type StrokeDto } from '@kanadrill/shared';
import { buildKanaSeeds } from './seed/seed-items';
import { loadKanjiRecords } from './seed/kanji-seed';

/** Générateur pseudo-aléatoire déterministe (mulberry32) : les tests ne changent pas d'une exécution à l'autre. */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Drawing {
  scale?: number;
  dx?: number;
  dy?: number;
  /** Amplitude (en unités du repère) d'une déformation lisse : le tracé « à main levée ». */
  warp?: number;
  /** Bruit aléatoire par point. */
  jitter?: number;
  reverse?: number[];
  order?: number[];
}

/** Ce qu'un utilisateur dessinerait en copiant le modèle : relevé de points, avec échelle, décalage et tremblements. */
function userDrawing(strokes: readonly StrokeDto[], random: () => number, options: Drawing = {}): Point2D[][] {
  const { scale = 1, dx = 0, dy = 0, warp = 0, jitter = 0 } = options;
  const phase = [random() * 6.28, random() * 6.28];
  const freq = [0.7 + random() * 0.8, 0.7 + random() * 0.8];
  const lines = strokes.map((stroke, i) => {
    const points = resample(flattenPath(stroke.d), 40);
    return options.reverse?.includes(i) ? points.reverse() : points;
  });
  const drawn = lines.map((points) =>
    points.map(([x, y]): Point2D => {
      const wx = x + warp * Math.sin(6.28 * freq[0] * (y / 109) + phase[0]);
      const wy = y + warp * Math.sin(6.28 * freq[1] * (x / 109) + phase[1]);
      return [
        54.5 + (wx - 54.5) * scale + dx + (random() - 0.5) * 2 * jitter,
        54.5 + (wy - 54.5) * scale + dy + (random() - 0.5) * 2 * jitter,
      ];
    }),
  );
  return options.order ? options.order.map((k) => drawn[k]) : drawn;
}

const KANA = buildKanaSeeds(); // 208 kana, hiragana et katakana, yōon compris
const MULTI = KANA.filter((kana) => kana.metadata.strokes.length >= 2);
const share = (count: number, total: number) => count / total;

describe('flattenPath', () => {
  it('suit les segments droits, en absolu et en relatif', () => {
    expect(flattenPath('M10,20L30,20V40h-5v5')).toEqual([[10, 20], [30, 20], [30, 40], [25, 40], [25, 45]]);
  });

  it('échantillonne les courbes de Bézier (relatives) jusqu\'au point d\'arrivée', () => {
    const points = flattenPath('M0,0c10,0,20,10,30,30', 10);
    expect(points).toHaveLength(11);
    expect(points[0]).toEqual([0, 0]);
    expect(points[10][0]).toBeCloseTo(30);
    expect(points[10][1]).toBeCloseTo(30);
  });

  it('gère S (réflexion du point de contrôle), Q et Z', () => {
    expect(flattenPath('M0,0C0,10,10,10,10,0S20,-10,20,0', 4).at(-1)).toEqual([20, 0]);
    expect(flattenPath('M0,0Q5,10,10,0', 4).at(-1)).toEqual([10, 0]);
    expect(flattenPath('M1,1L5,1L5,5Z').at(-1)).toEqual([1, 1]);
  });

  it('refuse les arcs et les chemins invalides', () => {
    expect(() => flattenPath('M0,0A1,1,0,0,1,2,2')).toThrow();
    expect(() => flattenPath('M1')).toThrow();
  });
});

describe('resample', () => {
  it('garde les extrémités et espace les points régulièrement', () => {
    const points = resample([[0, 0], [10, 0]], 6);
    expect(points).toHaveLength(6);
    expect(points.map((p) => p[0])).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it('gère un trait réduit à un point', () => {
    expect(resample([[3, 4]], 4)).toEqual([[3, 4], [3, 4], [3, 4], [3, 4]]);
  });
  it('ne plante pas sur des points confondus', () => {
    expect(resample([[0, 0], [0, 0], [4, 0]], 3).map((p) => p[0])).toEqual([0, 2, 4]);
  });
});

describe('scoreDrawing', () => {
  it('juge « juste » le modèle recopié, pour les 208 kana', () => {
    const random = rng(1);
    for (const kana of KANA) {
      const score = scoreDrawing(userDrawing(kana.metadata.strokes, random), kana.metadata.strokes);
      expect([kana.character, score.verdict]).toEqual([kana.character, 'good']);
      expect(score.issues).toEqual([]);
    }
  });

  it('ignore la taille et la position du dessin', () => {
    const random = rng(2);
    for (const kana of KANA) {
      const small = scoreDrawing(userDrawing(kana.metadata.strokes, random, { scale: 0.55, dx: 12, dy: -9 }), kana.metadata.strokes);
      const large = scoreDrawing(userDrawing(kana.metadata.strokes, random, { scale: 1.1, dx: -4, dy: 3 }), kana.metadata.strokes);
      expect([kana.character, small.verdict, large.verdict]).toEqual([kana.character, 'good', 'good']);
    }
  });

  it('accepte un tracé à main levée léger : jamais faux, presque toujours juste', () => {
    const random = rng(3);
    let good = 0;
    for (const kana of KANA) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const drawing = userDrawing(kana.metadata.strokes, random, { scale: 0.6 + random() * 0.5, dx: (random() - 0.5) * 20, dy: (random() - 0.5) * 20, warp: 3, jitter: 1 });
        const { verdict } = scoreDrawing(drawing, kana.metadata.strokes);
        expect(verdict).not.toBe('wrong');
        if (verdict === 'good') good++;
      }
    }
    expect(share(good, KANA.length * 3)).toBeGreaterThan(0.9);
  });

  it('reste indulgent avec un tracé plus brouillon : « approximatif » plutôt que faux', () => {
    const random = rng(4);
    const tally = { good: 0, fair: 0, wrong: 0 };
    for (const kana of KANA) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const drawing = userDrawing(kana.metadata.strokes, random, { scale: 0.6 + random() * 0.5, warp: 5, jitter: 1 });
        tally[scoreDrawing(drawing, kana.metadata.strokes).verdict]++;
      }
    }
    expect(share(tally.wrong, KANA.length * 3)).toBeLessThan(0.12);
    expect(tally.fair).toBeGreaterThan(0); // la zone « approximatif » existe bel et bien
  });

  it('refuse un trait tracé dans le mauvais sens, en le désignant', () => {
    const random = rng(5);
    for (const kana of MULTI) {
      // On inverse le trait le plus long : le sens d'un tout petit trait (accent, dakuten) ne se juge pas.
      const lengths = kana.metadata.strokes.map((stroke) => polylineLength(flattenPath(stroke.d)));
      const longest = lengths.indexOf(Math.max(...lengths));
      const score = scoreDrawing(userDrawing(kana.metadata.strokes, random, { warp: 3, jitter: 1, reverse: [longest] }), kana.metadata.strokes);
      expect([kana.character, score.verdict]).toEqual([kana.character, 'wrong']);
      expect(score.flagged).toContain(longest);
    }
  });

  it('ne juge pas le sens d\'un trait trop court (petit trait d\'un yōon)', () => {
    const random = rng(10);
    const found = KANA.flatMap((kana) =>
      kana.metadata.strokes.flatMap((stroke, index) =>
        polylineLength(flattenPath(stroke.d)) < DRAWING_SCORE.minDirectionLength ? [{ kana, index }] : [],
      ),
    );
    expect(found.length).toBeGreaterThan(0); // il existe de tels traits (ex. dans ャ, ュ, ョ)
    for (const { kana, index } of found) {
      const score = scoreDrawing(userDrawing(kana.metadata.strokes, random, { reverse: [index] }), kana.metadata.strokes);
      expect([kana.character, score.verdict]).toEqual([kana.character, expect.not.stringMatching(/^wrong$/)]);
    }
  });

  it('refuse des traits dans le mauvais ordre', () => {
    const random = rng(6);
    for (const kana of MULTI) {
      const order = kana.metadata.strokes.map((_, i) => i);
      [order[0], order[1]] = [order[1], order[0]];
      const score = scoreDrawing(userDrawing(kana.metadata.strokes, random, { warp: 3, jitter: 1, order }), kana.metadata.strokes);
      expect([kana.character, score.verdict]).toEqual([kana.character, 'wrong']);
    }
  });

  it('refuse un nombre de traits différent', () => {
    const random = rng(7);
    for (const kana of MULTI) {
      const strokes = kana.metadata.strokes;
      const missing = scoreDrawing(userDrawing(strokes.slice(1), random), strokes);
      expect(missing.issues).toEqual([{ type: 'strokeCount', expected: strokes.length, actual: strokes.length - 1 }]);
      const extra = scoreDrawing(userDrawing([...strokes, strokes[0]], random), strokes);
      expect(extra.verdict).toBe('wrong');
      expect(extra.issues[0]).toMatchObject({ type: 'strokeCount', actual: strokes.length + 1 });
    }
  });

  it('refuse presque toujours un autre kana (de même nombre de traits)', () => {
    const random = rng(8);
    let total = 0;
    let accepted = 0;
    for (const target of KANA.filter((kana) => kana.type === 'hiragana')) {
      for (const other of KANA.filter((kana) => kana.type === 'hiragana')) {
        if (other === target || other.metadata.strokes.length !== target.metadata.strokes.length) continue;
        total++;
        const drawing = userDrawing(other.metadata.strokes, random, { warp: 3, jitter: 1, scale: 0.8 });
        if (scoreDrawing(drawing, target.metadata.strokes).verdict !== 'wrong') accepted++;
      }
    }
    // Seules passent les paires qui se ressemblent vraiment (ね / ぬ, る / ろ, れ / わ…).
    expect(share(accepted, total)).toBeLessThan(0.02);
  });

  it('refuse un dessin trop petit pour être jugé', () => {
    const { strokes } = KANA[0].metadata;
    const score = scoreDrawing(userDrawing(strokes, rng(9), { scale: 0.15 }), strokes);
    expect(score).toMatchObject({ verdict: 'wrong', issues: [{ type: 'tooSmall' }] });
  });

  it('refuse un dessin vide', () => {
    const { strokes } = KANA[0].metadata;
    expect(scoreDrawing([], strokes).verdict).toBe('wrong');
  });
});

describe('scoreDrawing sur les kanji (N5 à N3 : plus de traits, plus denses)', () => {
  const KANJI = loadKanjiRecords().filter((kanji) => kanji.jlpt !== null && kanji.jlpt >= 3 && kanji.strokes.length > 0);
  const longest = (strokes: readonly StrokeDto[]) => {
    const lengths = strokes.map((stroke) => polylineLength(flattenPath(stroke.d)));
    return lengths.indexOf(Math.max(...lengths));
  };

  it('couvre des centaines de kanji, avec plusieurs traits en moyenne', () => {
    expect(KANJI.length).toBeGreaterThan(600);
    expect(KANJI.reduce((sum, kanji) => sum + kanji.strokes.length, 0) / KANJI.length).toBeGreaterThan(6);
  });

  it('juge « juste » le modèle recopié, même redimensionné', () => {
    const random = rng(21);
    for (const kanji of KANJI) {
      const verdict = scoreDrawing(userDrawing(kanji.strokes, random, { scale: 0.6 + random() * 0.5, dx: 8, dy: -6 }), kanji.strokes).verdict;
      expect([kanji.c, verdict]).toEqual([kanji.c, 'good']);
    }
  });

  it('accepte un tracé à main levée léger, refuse de moins en moins sévèrement un tracé brouillon', () => {
    const random = rng(22);
    let good = 0;
    for (const kanji of KANJI) {
      const light = scoreDrawing(userDrawing(kanji.strokes, random, { warp: 3, jitter: 1 }), kanji.strokes).verdict;
      expect([kanji.c, light === 'wrong']).toEqual([kanji.c, false]);
      if (light === 'good') good++;
    }
    expect(share(good, KANJI.length)).toBeGreaterThan(0.95);

    const tally = { good: 0, fair: 0, wrong: 0 };
    for (const kanji of KANJI) tally[scoreDrawing(userDrawing(kanji.strokes, random, { warp: 5, jitter: 1 }), kanji.strokes).verdict]++;
    expect(share(tally.wrong, KANJI.length)).toBeLessThan(0.25); // sur un kanji dense, un seul trait trop loin suffit
    expect(tally.fair).toBeGreaterThan(0);
  });

  it('refuse un trait inversé, des traits permutés ou manquants', () => {
    const random = rng(23);
    let misordered = 0;
    let multi = 0;
    for (const kanji of KANJI.filter((candidate) => candidate.strokes.length >= 2)) {
      const { strokes } = kanji;
      const reversed = scoreDrawing(userDrawing(strokes, random, { warp: 3, jitter: 1, reverse: [longest(strokes)] }), strokes);
      expect([kanji.c, reversed.verdict]).toEqual([kanji.c, 'wrong']);
      const order = strokes.map((_, i) => i);
      [order[0], order[1]] = [order[1], order[0]];
      multi++;
      if (scoreDrawing(userDrawing(strokes, random, { warp: 3, jitter: 1, order }), strokes).verdict === 'wrong') misordered++;
      expect(scoreDrawing(userDrawing(strokes.slice(1), random), strokes).issues[0]).toMatchObject({ type: 'strokeCount' });
    }
    // Deux traits voisins quasi identiques (ex. 費) peuvent s'échanger sans qu'on s'en aperçoive.
    expect(share(misordered, multi)).toBeGreaterThan(0.99);
  });

  it('refuse presque toujours un autre kanji de même nombre de traits', () => {
    const random = rng(24);
    const sameCount = (strokes: readonly StrokeDto[]) => KANJI.filter((other) => other.strokes.length === strokes.length);
    let total = 0;
    let accepted = 0;
    for (const target of KANJI) {
      const candidates = sameCount(target.strokes).filter((other) => other !== target);
      for (let attempt = 0; attempt < 3 && candidates.length > 0; attempt++) {
        const other = candidates[Math.floor(random() * candidates.length)];
        total++;
        if (scoreDrawing(userDrawing(other.strokes, random, { warp: 3, jitter: 1, scale: 0.8 }), target.strokes).verdict !== 'wrong') accepted++;
      }
    }
    expect(share(accepted, total)).toBeLessThan(0.01); // seules passent des paires quasi identiques (八 / 入, 牛 / 午)
  });
});
