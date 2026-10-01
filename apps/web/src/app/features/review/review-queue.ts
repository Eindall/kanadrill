import type { ItemDto, SessionCardDto } from '@kanadrill/shared';

/** Une réponse donnée pendant la session (une carte ratée peut en produire plusieurs). */
export interface Attempt {
  card: SessionCardDto;
  correct: boolean;
  expected: string;
  durationMs: number;
  /** Prochaine échéance renvoyée par le serveur (ISO 8601). */
  nextDue: string;
}

export interface SessionSummary {
  /** Cartes distinctes révisées. */
  cards: number;
  /** Cartes réussies dès la première réponse. */
  firstTryCorrect: number;
  /** 0–100, calculé sur la première réponse de chaque carte. */
  successRate: number;
  averageDurationMs: number;
  /** Cartes ratées à la première réponse, avec leur lecture. */
  missed: Array<{ item: ItemDto; expected: string }>;
  /** Échéance la plus proche parmi les cartes revues (après leur dernière réponse), ou null. */
  nextDue: string | null;
}

/**
 * Passe à la carte suivante. Une carte ratée est remise en fin de file : elle sera reposée
 * avant la fin de la session (le serveur, lui, la replanifie déjà via FSRS).
 */
export function advanceQueue(queue: readonly SessionCardDto[], correct: boolean): SessionCardDto[] {
  const [head, ...rest] = queue;
  if (head === undefined) return [];
  return correct ? rest : [...rest, head];
}

export function summarize(attempts: readonly Attempt[]): SessionSummary {
  const first = new Map<string, Attempt>();
  const last = new Map<string, Attempt>();
  for (const attempt of attempts) {
    const id = attempt.card.item.id;
    if (!first.has(id)) first.set(id, attempt);
    last.set(id, attempt);
  }
  const firsts = [...first.values()];
  const correct = firsts.filter((attempt) => attempt.correct).length;
  const nextDue = [...last.values()].map((attempt) => attempt.nextDue).sort()[0] ?? null;

  return {
    cards: firsts.length,
    firstTryCorrect: correct,
    successRate: firsts.length === 0 ? 0 : Math.round((correct / firsts.length) * 100),
    averageDurationMs:
      attempts.length === 0 ? 0 : Math.round(attempts.reduce((sum, a) => sum + a.durationMs, 0) / attempts.length),
    missed: firsts.filter((attempt) => !attempt.correct).map((a) => ({ item: a.card.item, expected: a.expected })),
    nextDue,
  };
}
