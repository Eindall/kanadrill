/**
 * Exécuté par Jest AVANT chaque fichier de test, donc avant l'import de AppModule.
 *
 * Indispensable : `ConfigModule.forRoot()` lit les variables d'environnement au moment où AppModule est importé.
 * Les définir plus tard (dans un `beforeAll`) est trop tard : l'application se connecterait à la base du `.env`
 * (ta base de dev) et les tests d'intégration y feraient leurs `TRUNCATE`.
 */
const url = process.env['TEST_DATABASE_URL'];

if (url) {
  const database = new URL(url).pathname.slice(1);
  if (!/test/i.test(database)) {
    throw new Error(
      `TEST_DATABASE_URL pointe vers « ${database} » : le nom d'une base de test doit contenir « test » ` +
        `(les tests d'intégration vident les tables). Ex. postgres://…/kanadrill_test`,
    );
  }
  Object.assign(process.env, {
    DATABASE_URL: url,
    JWT_SECRET: 'test-secret-test-secret-test-secret-test',
    APP_URL: 'http://localhost:4200',
    DISCORD_CLIENT_ID: 'test-client-id',
    DISCORD_CLIENT_SECRET: 'test-client-secret',
    DISCORD_REDIRECT_URI: 'http://localhost:4200/api/auth/discord/callback',
  });
}
