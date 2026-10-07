import { AUTH_PROVIDERS, type AuthProvider } from '@kanadrill/shared';

export const PROVIDER_LABELS: Record<AuthProvider, string> = { discord: 'Discord', google: 'Google' };

/** Fournisseurs de connexion, dans l'ordre d'affichage. */
export const PROVIDERS: readonly AuthProvider[] = AUTH_PROVIDERS;
