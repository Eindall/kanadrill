import { CARD_STATE } from '@kanadrill/shared';
import { composeSession, pickMode, type Candidate } from './compose-session';

const NOW = new Date('2026-10-01T12:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

interface Card extends Candidate {
  name: string;
}
const fresh = (name: string, sortOrder: number): Card => ({ name, state: CARD_STATE.New, due: null, lastReview: null, sortOrder });
const seen = (name: string, sortOrder: number, dueInHours: number, lastReviewHoursAgo: number, state: number = CARD_STATE.Review): Card => ({
  name,
  state,
  due: hours(dueInHours),
  lastReview: hours(-lastReviewHoursAgo),
  sortOrder,
});
const names = (cards: Card[], count: number) => composeSession(cards, count, NOW).map((c) => c.candidate.name);

describe('composeSession', () => {
  it('met les cartes dues d\'abord (les plus en retard), puis les nouvelles', () => {
    const cards = [fresh('n2', 2), seen('d-recent', 10, -1, 5), fresh('n1', 1), seen('d-old', 11, -10, 20)];
    const composed = composeSession(cards, 4, NOW);
    expect(composed.map((c) => c.candidate.name).slice(0, 2)).toEqual(['d-old', 'd-recent']);
    expect(composed.map((c) => c.candidate.name).slice(2).sort()).toEqual(['n1', 'n2']);
    expect(composed.map((c) => c.origin)).toEqual(['due', 'due', 'new', 'new']);
  });

  it('tire les nouvelles cartes au hasard dans tout le lot, pas toujours les premières de la table', () => {
    const cards = Array.from({ length: 40 }, (_, i) => fresh(`n${i}`, i));
    const firstFive = ['n0', 'n1', 'n2', 'n3', 'n4'];
    const picks = Array.from({ length: 30 }, () => names(cards, 5));
    // Chaque tirage est sans doublon ; sur 30 tirages, on ne retombe pas toujours sur le même ordre ni les mêmes cartes.
    for (const pick of picks) expect(new Set(pick).size).toBe(5);
    expect(new Set(picks.map((pick) => pick.join())).size).toBeGreaterThan(1);
    expect(picks.some((pick) => pick.join() !== firstFive.join())).toBe(true);
    expect(new Set(picks.flat()).size).toBeGreaterThan(5);
  });

  it('est reproductible avec un générateur donné (permutation de toutes les nouvelles cartes)', () => {
    const cards = Array.from({ length: 6 }, (_, i) => fresh(`n${i}`, i));
    const composed = composeSession(cards, 6, NOW, () => 0.5).map((c) => c.candidate.name);
    expect(composed).toEqual(composeSession(cards, 6, NOW, () => 0.5).map((c) => c.candidate.name));
    expect([...composed].sort()).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
  });

  it('complète avec les cartes vues mais pas dues, la moins récemment vue d\'abord', () => {
    const cards = [seen('vu-hier', 1, 24, 24), seen('vu-il-y-a-1h', 2, 24, 1), seen('vu-il-y-a-3j', 3, 24, 72)];
    const composed = composeSession(cards, 3, NOW);
    expect(composed.map((c) => c.candidate.name)).toEqual(['vu-il-y-a-3j', 'vu-hier', 'vu-il-y-a-1h']);
    expect(composed.every((c) => c.origin === 'extra')).toBe(true);
  });

  it('s\'arrête au nombre demandé sans cycler quand il y a assez de cartes', () => {
    const cards = Array.from({ length: 40 }, (_, i) => fresh(`n${i}`, i));
    const result = names(cards, 15);
    expect(result).toHaveLength(15);
    expect(new Set(result).size).toBe(15);
  });

  it('cycle sur les cartes existantes quand la sélection est trop petite', () => {
    const cards = [fresh('a', 1), fresh('b', 2), fresh('c', 3)];
    const composed = composeSession(cards, 8, NOW);
    const round = composed.slice(0, 3).map((c) => c.candidate.name);
    expect([...round].sort()).toEqual(['a', 'b', 'c']);
    // Le cycle repasse dans le même ordre que le premier tour.
    expect(composed.map((c) => c.candidate.name)).toEqual([...round, ...round, ...round.slice(0, 2)]);
    expect(composed.map((c) => c.origin)).toEqual(['new', 'new', 'new', 'extra', 'extra', 'extra', 'extra', 'extra']);
  });

  it('ne pose jamais deux fois de suite la même carte tant qu\'il y en a au moins deux', () => {
    for (const size of [2, 3, 7]) {
      const cards = Array.from({ length: size }, (_, i) => fresh(`n${i}`, i));
      const result = names(cards, 50);
      expect(result).toHaveLength(50);
      result.slice(1).forEach((name, i) => expect(name).not.toBe(result[i]));
    }
  });

  it('accepte de répéter l\'unique carte s\'il n\'y en a qu\'une', () => {
    expect(names([fresh('seule', 1)], 3)).toEqual(['seule', 'seule', 'seule']);
  });

  it('renvoie une liste vide si la sélection est vide', () => {
    expect(composeSession([], 30, NOW)).toEqual([]);
  });

  it('traite une carte en apprentissage dont l\'échéance est passée comme due', () => {
    const cards = [fresh('n', 1), seen('learning', 2, -0.1, 1, CARD_STATE.Learning)];
    expect(names(cards, 2)).toEqual(['learning', 'n']);
  });
});

describe('pickMode', () => {
  it('renvoie l\'unique mode coché', () => {
    expect(pickMode(['typing'])).toBe('typing');
  });
  it('tire parmi les modes cochés', () => {
    expect(pickMode(['choice', 'typing'], () => 0)).toBe('choice');
    expect(pickMode(['choice', 'typing'], () => 0.99)).toBe('typing');
  });
});
