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
