/** Mélange de Fisher-Yates (renvoie une copie). `random` est injectable pour les tests. */
export function shuffle<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
