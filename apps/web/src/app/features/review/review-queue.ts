import type { ItemDto, SessionCardDto } from '@kanadrill/shared';

/**
 * Une place dans la file de la session. Avec le cycle, un même item peut y figurer plusieurs fois :
 * la `key` distingue les places (et non les items) pour le bilan.
 */
export interface QueueEntry {
  key: number;
  card: SessionCardDto;
}

/** Une réponse donnée pendant la session (une carte ratée peut en produire plusieurs). */
export interface Attempt {
  key: number;
  card: SessionCardDto;
  correct: boolean;
  expected: string;
  durationMs: number;
  /** Points gagnés (0 si ratée), tels que le serveur les a comptés. */
  points: number;
  /** Prochaine échéance renvoyée par le serveur (ISO 8601). */
  nextDue: string;
}

export interface SessionSummary {
  /** Cartes de la session (places distinctes de la file). */
  cards: number;
  /** Cartes réussies dès la première réponse. */
  firstTryCorrect: number;
  /** 0–100, calculé sur la première réponse de chaque carte. */
  successRate: number;
  averageDurationMs: number;
  /** Total des points gagnés pendant la session (toutes les réponses, y compris les cartes reposées). */
  points: number;
  /** Items ratés à la première réponse, avec leur lecture (sans doublon). */
  missed: Array<{ item: ItemDto; expected: string }>;
  /** Échéance la plus proche parmi les cartes revues (après leur dernière réponse), ou null. */
  nextDue: string | null;
}

export function toQueue(cards: readonly SessionCardDto[]): QueueEntry[] {
  return cards.map((card, key) => ({ key, card }));
}

/**
 * Passe à la carte suivante. Une carte ratée est remise en fin de file : elle sera reposée
 * avant la fin de la session (le serveur, lui, la replanifie déjà via FSRS).
 */
export function advanceQueue<T>(queue: readonly T[], correct: boolean): T[] {
  const [head, ...rest] = queue;
  if (head === undefined) return [];
  return correct ? rest : [...rest, head];
}

export function summarize(attempts: readonly Attempt[]): SessionSummary {
  const first = new Map<number, Attempt>();
  const last = new Map<number, Attempt>();
  for (const attempt of attempts) {
    if (!first.has(attempt.key)) first.set(attempt.key, attempt);
    last.set(attempt.key, attempt);
  }
  const firsts = [...first.values()];
  const correct = firsts.filter((attempt) => attempt.correct).length;
  const nextDue = [...last.values()].map((attempt) => attempt.nextDue).sort()[0] ?? null;

  const missed = new Map<string, { item: ItemDto; expected: string }>();
  for (const attempt of firsts) {
    if (!attempt.correct) missed.set(attempt.card.item.id, { item: attempt.card.item, expected: attempt.expected });
  }

  return {
    cards: firsts.length,
    firstTryCorrect: correct,
    successRate: firsts.length === 0 ? 0 : Math.round((correct / firsts.length) * 100),
    averageDurationMs:
      attempts.length === 0 ? 0 : Math.round(attempts.reduce((sum, a) => sum + a.durationMs, 0) / attempts.length),
    points: attempts.reduce((sum, a) => sum + a.points, 0),
    missed: [...missed.values()],
    nextDue,
  };
}
