import type { DayActivityDto, IsoDay } from '@kanadrill/shared';

/** Un jour face à l'objectif : rien, quelques cartes (sous l'objectif), objectif atteint. */
export type DayState = 'none' | 'partial' | 'goal';

export function dayState(answers: number, goal: number): DayState {
  if (answers <= 0) return 'none';
  return answers >= goal ? 'goal' : 'partial';
}

/** `AAAA-MM-JJ` → date locale à midi (jamais décalée d'un jour par un fuseau). */
export function parseDay(day: IsoDay): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
}

export function toIsoDay(date: Date): IsoDay {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const format = (options: Intl.DateTimeFormatOptions) => (day: IsoDay) => parseDay(day).toLocaleDateString('fr-FR', options);
/** « L », « M »… (initiale du jour de la semaine). */
export const weekdayLetter = (day: IsoDay): string => format({ weekday: 'narrow' })(day).toUpperCase();
/** « lundi 12 octobre ». */
export const longDay = format({ weekday: 'long', day: 'numeric', month: 'long' });
/** « 12 oct. ». */
export const shortDay = format({ day: 'numeric', month: 'short' });
/** « oct. 2026 ». */
export const monthYear = format({ month: 'short', year: 'numeric' });

/** Regroupement d'une période : au jour, à la semaine (lundi à dimanche) ou au mois, selon sa longueur. */
export type BucketSize = 'day' | 'week' | 'month';

export function bucketSize(dayCount: number): BucketSize {
  if (dayCount <= 45) return 'day';
  return dayCount <= 180 ? 'week' : 'month';
}

export interface Bucket {
  /** Premier jour (dans la période) du groupe. */
  start: IsoDay;
  end: IsoDay;
  /** Libellé court de l'axe. */
  label: string;
  /** Libellé complet (info-bulle, tableau). */
  title: string;
  answers: number;
  correct: number;
  /** Nombre de jours de la période dans ce groupe. */
  days: number;
}

function mondayOf(day: IsoDay): IsoDay {
  const date = parseDay(day);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toIsoDay(date);
}

/** Regroupe les jours (déjà complets : un par jour) ; le premier et le dernier groupe peuvent être partiels. */
export function bucketActivity(days: readonly DayActivityDto[], size: BucketSize = bucketSize(days.length)): Bucket[] {
  const keyOf = (day: IsoDay): string => (size === 'day' ? day : size === 'week' ? mondayOf(day) : day.slice(0, 7));
  const groups = new Map<string, DayActivityDto[]>();
  for (const day of days) groups.set(keyOf(day.date), [...(groups.get(keyOf(day.date)) ?? []), day]);

  return [...groups.entries()].map(([key, group]): Bucket => {
    const start = group[0].date;
    const end = group[group.length - 1].date;
    return {
      start,
      end,
      label: size === 'day' ? shortDay(start) : size === 'week' ? shortDay(key) : monthYear(start),
      title: size === 'day' ? longDay(start) : size === 'week' ? `semaine du ${shortDay(key)}` : monthYear(start),
      answers: group.reduce((sum, d) => sum + d.answers, 0),
      correct: group.reduce((sum, d) => sum + d.correct, 0),
      days: group.length,
    };
  });
}

/** Taux de réussite en % (arrondi), `null` sans réponse. */
export function successRate(answers: number, correct: number): number | null {
  return answers > 0 ? Math.round((correct / answers) * 100) : null;
}

/**
 * Échelle de l'axe vertical : un maximum « rond » (1, 2, 4, 6, 8 ou 10 × une puissance de 10) pour que les trois graduations
 * (0, moitié, maximum) tombent sur des entiers lisibles.
 */
export function niceScale(max: number): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 2, ticks: [0, 1, 2] };
  const power = 10 ** Math.floor(Math.log10(max));
  // Sous 10, un maximum de 1 donnerait une moitié non entière (0,5) : on part de 2.
  const steps = power >= 10 ? [1, 2, 4, 6, 8, 10] : [2, 4, 6, 8, 10];
  const step = steps.find((candidate) => candidate * power >= max) ?? 10;
  const niceMax = step * power;
  return { max: niceMax, ticks: [0, niceMax / 2, niceMax] };
}

/** Indices des étiquettes de l'axe horizontal à afficher : au plus `limit`, régulièrement espacés, dernier compris. */
export function labelIndices(count: number, limit = 6): Set<number> {
  if (count <= limit) return new Set(Array.from({ length: count }, (_, i) => i));
  const step = Math.ceil((count - 1) / (limit - 1));
  const indices = new Set<number>();
  for (let i = count - 1; i >= 0 && indices.size < limit; i -= step) indices.add(i);
  return indices;
}
