/** Fournisseurs d'authentification supportés. Ajouter ici pour en activer un nouveau. */
export const AUTH_PROVIDERS = ['discord', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export function isAuthProvider(value: unknown): value is AuthProvider {
  return typeof value === 'string' && (AUTH_PROVIDERS as readonly string[]).includes(value);
}

/** Réponse de `POST /api/auth/:provider/link` : l'URL d'autorisation chez le fournisseur, vers laquelle naviguer. */
export interface LinkStartResponse {
  url: string;
}

/** Règles du pseudo, partagées entre le front (validation de formulaire) et l'API. */
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[\p{L}\p{N}_\-. ]+$/u;

/** Une session ouverte (un appareil connecté), telle que l'affiche le profil. */
export interface SessionInfoDto {
  id: string;
  /** Appareil lisible, ex. « Chrome sur Linux ». */
  device: string;
  createdAt: string;
  lastUsedAt: string;
  /** C'est la session de la requête en cours. */
  current: boolean;
}
