import { expandRomajiVariants, normalizeMeaning } from '@kanadrill/shared';
import { shuffle } from './shuffle';

export const CHOICE_COUNT = 4;

/**
 * Propositions d'un QCM : la lecture de référence + des leurres pris dans `pool` (lectures d'autres items).
 * Un leurre qui serait aussi une réponse valable (ex. « o » pour お et を) est écarté, et il n'y a pas de doublon.
 */
export function buildChoices(
  item: { readings: readonly string[] },
  pool: ReadonlyArray<{ readings: readonly string[] }>,
  random: () => number = Math.random,
): string[] {
  const correct = item.readings[0];
  const accepted = new Set(item.readings.flatMap((reading) => expandRomajiVariants(reading)));
  const candidates = [...new Set(pool.map((other) => other.readings[0]))].filter(
    (reading) => !expandRomajiVariants(reading).some((variant) => accepted.has(variant)),
  );
  const distractors = shuffle(candidates, random).slice(0, CHOICE_COUNT - 1);
  return shuffle([correct, ...distractors], random);
}

/** Un sens possible comme leurre, avec sa langue (on ne mélange pas français et anglais dans un même QCM). */
export interface MeaningDecoy {
  meaning: string;
  language: string;
}

/**
 * Propositions du QCM sur le sens d'un kanji : son premier sens + des leurres pris dans `pool` (premiers sens
 * d'autres kanji), dans la même langue pour que celle-ci ne trahisse rien. Un leurre qui serait aussi un sens
 * valable du kanji est écarté, et il n'y a pas de doublon.
 */
export function buildMeaningChoices(
  item: { meanings: readonly string[]; language: string },
  pool: readonly MeaningDecoy[],
  random: () => number = Math.random,
): string[] {
  const correct = item.meanings[0];
  const taken = new Set(item.meanings.map(normalizeMeaning));
  const seen = new Set<string>();
  const candidates = pool.filter(({ meaning, language }) => {
    const key = normalizeMeaning(meaning);
    if (language !== item.language || taken.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const distractors = shuffle(candidates, random)
    .slice(0, CHOICE_COUNT - 1)
    .map((decoy) => decoy.meaning);
  return shuffle([correct, ...distractors], random);
}

/** Ce qu'il faut savoir d'un élément pour le proposer (ou l'écarter) dans un QCM inversé. */
export interface ReverseSubject {
  character: string;
  readings: readonly string[];
  meanings: readonly string[];
}

/**
 * Propositions du QCM inversé : le caractère de l'élément + des leurres tirés de `pools` (le premier lot d'abord,
 * puis les suivants si besoin : les leurres du même niveau avant les autres). On voit la lecture (`reading`, pour un
 * kana) ou le sens (`meaning`, pour un kanji) : un leurre qui partagerait cette lecture ou ce sens serait aussi une
 * bonne réponse (お et を se lisent « o », 日 et 曜 partagent parfois un sens) et est écarté.
 */
export function buildReverseChoices(
  item: ReverseSubject,
  by: 'reading' | 'meaning',
  pools: ReadonlyArray<readonly ReverseSubject[]>,
  random: () => number = Math.random,
): string[] {
  const keys = (subject: ReverseSubject): Set<string> =>
    new Set(
      by === 'reading'
        ? subject.readings.flatMap((reading) => expandRomajiVariants(reading))
        : subject.meanings.map(normalizeMeaning),
    );
  const clashing = keys(item);
  const wanted = CHOICE_COUNT - 1;
  const chosen: string[] = [];
  const seen = new Set([item.character]);

  for (const pool of pools) {
    for (const other of shuffle(pool, random)) {
      if (chosen.length >= wanted) break;
      if (seen.has(other.character)) continue;
      seen.add(other.character);
      if ([...keys(other)].some((key) => clashing.has(key))) continue;
      chosen.push(other.character);
    }
    if (chosen.length >= wanted) break;
  }
  return shuffle([item.character, ...chosen], random);
}
