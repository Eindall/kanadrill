/**
 * Correction du romaji. Fonctions pures, utilisées par l'API (juge de la note) et par le front
 * (retour immédiat) : les deux doivent rester d'accord.
 */

/** Minuscules, sans espaces, tirets ni apostrophes (« n' » = « n »), caractères pleine chasse ramenés en ASCII. */
export function normalizeRomaji(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s'’`\-‐]/g, '');
}

/**
 * Réécritures Hepburn → Nihon-shiki / Kunrei (shi/si, tsu/tu, chi/ti, fu/hu, ji/zi, sha/sya, cha/tya…).
 * Chaque règle s'applique seule à la lecture d'origine (pas de chaînage).
 */
const ALTERNATES: ReadonlyArray<readonly [pattern: RegExp, replacements: readonly string[]]> = [
  [/^shi$/, ['si']],
  [/^chi$/, ['ti']],
  [/^tsu$/, ['tu']],
  [/^fu$/, ['hu']],
  [/^ji$/, ['zi', 'di']],
  [/^sh([aou])$/, ['sy$1']],
  [/^ch([aou])$/, ['ty$1', 'cy$1']],
  [/^j([aou])$/, ['jy$1', 'zy$1', 'dy$1']],
  [/^jy([aou])$/, ['j$1', 'zy$1']],
  [/^n$/, ['nn']],
];

/** Toutes les écritures acceptées pour une lecture (la lecture elle-même comprise). */
export function expandRomajiVariants(reading: string): string[] {
  const base = normalizeRomaji(reading);
  const variants = new Set([base]);
  for (const [pattern, replacements] of ALTERNATES) {
    if (pattern.test(base)) {
      for (const replacement of replacements) variants.add(base.replace(pattern, replacement));
    }
  }
  return [...variants];
}

/** La réponse correspond-elle à l'une des lectures (ou à l'une de leurs variantes) ? */
export function isRomajiCorrect(answer: string, readings: readonly string[]): boolean {
  const normalized = normalizeRomaji(answer);
  if (normalized === '') return false;
  return readings.some((reading) => expandRomajiVariants(reading).includes(normalized));
}
