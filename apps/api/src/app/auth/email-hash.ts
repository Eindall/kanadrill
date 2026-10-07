import { createHmac } from 'node:crypto';

/**
 * Empreinte d'un e-mail pour détecter les doublons entre fournisseurs : HMAC-SHA256 (hex) de l'adresse
 * `trim` + minuscules. Les points et les `+alias` sont conservés (pas de normalisation propre à un fournisseur).
 * Renvoie `null` si l'e-mail est absent ou si le fournisseur n'atteste pas qu'il est vérifié
 * (sinon quelqu'un pourrait déclarer l'adresse d'un autre pour bloquer sa connexion).
 * L'adresse en clair ne doit jamais sortir de cette fonction : ni stockée, ni loggée.
 */
export function hashEmail(email: string | null | undefined, verified: unknown, key: string): string | null {
  if (verified !== true || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return createHmac('sha256', key).update(normalized).digest('hex');
}
