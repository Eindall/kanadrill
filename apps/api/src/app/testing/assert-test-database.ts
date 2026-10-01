import type { DataSource } from 'typeorm';

/**
 * Dernier garde-fou des tests d'intégration, à appeler avant tout `TRUNCATE` : l'application doit être
 * connectée à la base de `TEST_DATABASE_URL` (et à une base dont le nom contient « test »), jamais à celle du `.env`.
 */
export function assertTestDatabase(dataSource: DataSource): void {
  const wanted = new URL(process.env['TEST_DATABASE_URL'] ?? 'postgres://x/').pathname.slice(1);
  const actual = (dataSource.driver as unknown as { database?: string }).database;
  if (!wanted || actual !== wanted || !/test/i.test(actual)) {
    throw new Error(
      `Refus de vider la base « ${actual} » : les tests d'intégration doivent tourner sur « ${wanted} » ` +
        `(TEST_DATABASE_URL, nom contenant « test »).`,
    );
  }
}
