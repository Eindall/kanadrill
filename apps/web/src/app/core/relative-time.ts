const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** « à l'instant », « il y a 5 minutes », « il y a 3 heures », « hier », « il y a 4 jours »… */
export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - new Date(date).getTime());
  if (elapsed < MINUTE) return "à l'instant";
  if (elapsed < HOUR) return formatter.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return formatter.format(-Math.floor(elapsed / HOUR), 'hour');
  return formatter.format(-Math.floor(elapsed / DAY), 'day');
}
