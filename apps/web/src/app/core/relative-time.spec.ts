import { relativeTime } from './relative-time';

const NOW = new Date('2026-10-01T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('relativeTime', () => {
  it('« à l\'instant » en dessous d\'une minute (et pour une date légèrement dans le futur)', () => {
    expect(relativeTime(ago(30_000), NOW)).toBe("à l'instant");
    expect(relativeTime(ago(-5_000), NOW)).toBe("à l'instant");
  });
  it('minutes, heures, jours', () => {
    expect(relativeTime(ago(5 * 60_000), NOW)).toBe('il y a 5 minutes');
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe('il y a 3 heures');
    expect(relativeTime(ago(24 * 3_600_000), NOW)).toBe('hier');
    expect(relativeTime(ago(4 * 24 * 3_600_000), NOW)).toBe('il y a 4 jours');
  });
  it('accepte une date ISO', () => {
    expect(relativeTime('2026-10-01T11:00:00Z', NOW)).toBe('il y a 1 heure');
  });
});
