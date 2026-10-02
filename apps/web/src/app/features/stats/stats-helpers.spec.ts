import type { DayActivityDto } from '@kanadrill/shared';
import { bucketActivity, bucketSize, dayState, labelIndices, niceScale, parseDay, successRate, toIsoDay, weekdayLetter } from './stats-helpers';

const days = (start: string, answers: number[]): DayActivityDto[] =>
  answers.map((count, i) => {
    const date = parseDay(start);
    date.setDate(date.getDate() + i);
    return { date: toIsoDay(date), answers: count, correct: Math.floor(count / 2) };
  });

describe('dayState', () => {
  it('distingue rien, quelques cartes et objectif atteint', () => {
    expect(dayState(0, 30)).toBe('none');
    expect(dayState(1, 30)).toBe('partial');
    expect(dayState(29, 30)).toBe('partial');
    expect(dayState(30, 30)).toBe('goal');
    expect(dayState(80, 30)).toBe('goal');
  });
});

describe('dates', () => {
  it('lit un jour sans décalage de fuseau', () => {
    expect(toIsoDay(parseDay('2026-10-12'))).toBe('2026-10-12');
    expect(toIsoDay(parseDay('2026-03-29'))).toBe('2026-03-29'); // changement d'heure
    expect(weekdayLetter('2026-10-12')).toBe('L'); // lundi
    expect(weekdayLetter('2026-10-17')).toBe('S'); // samedi
  });
});

describe('bucketSize', () => {
  it('passe du jour à la semaine puis au mois', () => {
    expect([7, 30, 45].map(bucketSize)).toEqual(['day', 'day', 'day']);
    expect([46, 90, 180].map(bucketSize)).toEqual(['week', 'week', 'week']);
    expect([181, 365, 731].map(bucketSize)).toEqual(['month', 'month', 'month']);
  });
});

describe('bucketActivity', () => {
  it('garde un groupe par jour sur une courte période', () => {
    const buckets = bucketActivity(days('2026-10-12', [3, 0, 5]), 'day');
    expect(buckets.map((b) => [b.start, b.answers, b.days])).toEqual([['2026-10-12', 3, 1], ['2026-10-13', 0, 1], ['2026-10-14', 5, 1]]);
  });

  it('groupe par semaine (lundi à dimanche), le premier groupe pouvant être partiel', () => {
    // mercredi 14 → dimanche 18 (5 jours), puis lundi 19 → mercredi 21 (3 jours)
    const buckets = bucketActivity(days('2026-10-14', [1, 2, 3, 4, 5, 10, 20, 30]), 'week');
    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({ start: '2026-10-14', end: '2026-10-18', answers: 15, correct: 6, days: 5 });
    expect(buckets[1]).toMatchObject({ start: '2026-10-19', end: '2026-10-21', answers: 60, days: 3 });
  });

  it('groupe par mois', () => {
    const buckets = bucketActivity(days('2026-09-29', [1, 1, 1, 1, 1]), 'month');
    expect(buckets.map((b) => [b.start, b.answers])).toEqual([['2026-09-29', 2], ['2026-10-01', 3]]);
  });

  it('choisit la taille de groupe d\'après la longueur de la période', () => {
    expect(bucketActivity(days('2026-01-01', Array(60).fill(1))).length).toBeLessThan(12); // semaines
  });
});

describe('successRate', () => {
  it('arrondit en pourcentage et ignore les périodes sans réponse', () => {
    expect(successRate(3, 2)).toBe(67);
    expect(successRate(10, 10)).toBe(100);
    expect(successRate(0, 0)).toBeNull();
  });
});

describe('niceScale', () => {
  it('arrondit le maximum à une valeur ronde avec une moitié entière', () => {
    expect(niceScale(0)).toEqual({ max: 2, ticks: [0, 1, 2] });
    expect(niceScale(1)).toEqual({ max: 2, ticks: [0, 1, 2] });
    expect(niceScale(7)).toEqual({ max: 8, ticks: [0, 4, 8] });
    expect(niceScale(30)).toEqual({ max: 40, ticks: [0, 20, 40] });
    expect(niceScale(45)).toEqual({ max: 60, ticks: [0, 30, 60] });
    expect(niceScale(100)).toEqual({ max: 100, ticks: [0, 50, 100] });
    expect(niceScale(101)).toEqual({ max: 200, ticks: [0, 100, 200] });
  });
});

describe('labelIndices', () => {
  it('affiche tout quand il y en a peu', () => {
    expect([...labelIndices(4)]).toEqual([0, 1, 2, 3]);
  });
  it('en choisit quelques-unes, régulièrement espacées, dernière comprise', () => {
    const indices = [...labelIndices(30)].sort((a, b) => a - b);
    expect(indices.length).toBeLessThanOrEqual(6);
    expect(indices).toContain(29);
    const gaps = indices.slice(1).map((value, i) => value - indices[i]);
    expect(new Set(gaps).size).toBe(1);
  });
});
