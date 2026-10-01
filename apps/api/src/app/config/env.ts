/**
 * Variables d'environnement requises. Le démarrage échoue immédiatement
 * (avec un message clair) si l'une d'elles manque, plutôt que de planter plus tard.
 */
const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'APP_URL',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  }
  if (String(config['JWT_SECRET']).length < 32) {
    throw new Error('JWT_SECRET doit faire au moins 32 caractères (ex. `openssl rand -hex 32`).');
  }
  return config;
}
