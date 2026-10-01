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
  const timezone = config['APP_TIMEZONE'];
  if (timezone !== undefined && timezone !== '') {
    try {
      new Intl.DateTimeFormat('fr', { timeZone: String(timezone) });
    } catch {
      throw new Error(`APP_TIMEZONE n'est pas un fuseau horaire IANA valide : ${String(timezone)}`);
    }
  }
  return config;
}

/** Fuseau qui définit le « jour » des révisions (limite quotidienne de nouvelles cartes). */
export const DEFAULT_TIMEZONE = 'Europe/Paris';
