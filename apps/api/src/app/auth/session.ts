export const SESSION_COOKIE = 'kd_session';
export const OAUTH_STATE_COOKIE = 'kd_oauth_state';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Une session expire après cette durée **sans usage** (expiration glissante : chaque usage la repousse). */
export const SESSION_IDLE_TTL_MS = 48 * HOUR_MS;

/** Plafond absolu : même utilisée tous les jours, une session ne dépasse jamais cet âge (reconnexion Discord). */
export const SESSION_ABSOLUTE_MAX_MS = 30 * DAY_MS;

/** `last_used_at` (et donc l'expiration) n'est mis à jour qu'au plus tous les… : évite une écriture par requête. */
export const SESSION_TOUCH_INTERVAL_MS = 10 * 60 * 1000;

/** Sessions actives simultanées par compte ; à la suivante, la plus ancienne est révoquée. */
export const MAX_ACTIVE_SESSIONS = 20;

/** Sessions expirées, ou révoquées depuis plus longtemps que ça, sont supprimées par le nettoyage. */
export const REVOKED_RETENTION_MS = 7 * DAY_MS;
export const CLEANUP_INTERVAL_MS = 6 * HOUR_MS;
