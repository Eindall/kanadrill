import type { SessionCardDto } from '@kanadrill/shared';
import { advanceQueue, summarize, type Attempt } from './review-queue';

const card = (id: string, character: string): SessionCardDto => ({
  item: { id, type: 'hiragana', character, readings: [id], meanings: [] },
  mode: 'choice',
  choices: [id],
  isNew: true,
});
const [a, b, c] = [card('a', 'あ'), card('i', 'い'), card('u', 'う')];
const attempt = (c: SessionCardDto, correct: boolean, durationMs = 1000, nextDue = '2030-01-01T00:00:00.000Z'): Attempt => ({
  card: c,
  correct,
  expected: c.item.readings[0],
  durationMs,
  nextDue,
});

describe('advanceQueue', () => {
  it('retire la carte réussie', () => {
    expect(advanceQueue([a, b, c], true)).toEqual([b, c]);
  });
  it('remet la carte ratée en fin de file', () => {
    expect(advanceQueue([a, b, c], false)).toEqual([b, c, a]);
  });
  it('gère la dernière carte et la file vide', () => {
    expect(advanceQueue([a], false)).toEqual([a]);
    expect(advanceQueue([a], true)).toEqual([]);
    expect(advanceQueue([], true)).toEqual([]);
  });
});

describe('summarize', () => {
  it('compte une carte ratée puis réussie comme ratée du premier coup', () => {
    const summary = summarize([attempt(a, false), attempt(b, true), attempt(a, true)]);
    expect(summary.cards).toBe(2);
    expect(summary.firstTryCorrect).toBe(1);
    expect(summary.successRate).toBe(50);
    expect(summary.missed.map((m) => m.item.character)).toEqual(['あ']);
  });
  it('calcule le temps moyen et l\'échéance la plus proche (dernière réponse de chaque carte)', () => {
    const summary = summarize([
      attempt(a, false, 1000, '2026-01-01T00:10:00.000Z'),
      attempt(b, true, 3000, '2026-01-05T00:00:00.000Z'),
      attempt(a, true, 2000, '2026-01-02T00:00:00.000Z'),
    ]);
    expect(summary.averageDurationMs).toBe(2000);
    expect(summary.nextDue).toBe('2026-01-02T00:00:00.000Z');
  });
  it('gère une session vide', () => {
    expect(summarize([])).toEqual({
      cards: 0,
      firstTryCorrect: 0,
      successRate: 0,
      averageDurationMs: 0,
      missed: [],
      nextDue: null,
    });
  });
});
