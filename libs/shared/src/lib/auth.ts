/** Fournisseurs d'authentification supportés. Ajouter ici pour en activer un nouveau. */
export const AUTH_PROVIDERS = ['discord'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/** Règles du pseudo, partagées entre le front (validation de formulaire) et l'API. */
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[\p{L}\p{N}_\-. ]+$/u;
