import { expandRomajiVariants } from '@kanadrill/shared';

export const CHOICE_COUNT = 4;

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
