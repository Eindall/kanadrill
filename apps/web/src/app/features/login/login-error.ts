import { isAuthProvider } from '@kanadrill/shared';
import { PROVIDER_LABELS } from '../../core/providers';

const MESSAGES: Record<string, string> = {
  state: 'La connexion a expiré avant la fin. Réessaie.',
  discord: "Discord n'a pas validé la connexion. Réessaie dans un instant.",
  google: "Google n'a pas validé la connexion. Réessaie dans un instant.",
};

/**
 * Message de la page de connexion pour `?error=…&provider=…&from=…`.
 * `provider` et `from` viennent de l'URL : ils ne sont utilisés que s'ils désignent un fournisseur connu
 * (sinon message générique), jamais affichés tels quels.
 */
export function loginErrorMessage(code: string | undefined, provider?: string, from?: string): string | null {
  if (!code) return null;
  if (code === 'account_exists') {
    if (!isAuthProvider(provider)) return 'Un compte KanaDrill existe déjà avec cette adresse. Connecte-toi avec ton autre fournisseur.';
    const existing = PROVIDER_LABELS[provider];
    const added = isAuthProvider(from) && from !== provider ? PROVIDER_LABELS[from] : 'ce fournisseur';
    return `Un compte KanaDrill existe déjà avec cette adresse. Connecte-toi avec ${existing}, puis ajoute ${added} depuis ton profil.`;
  }
  return MESSAGES[code] ?? 'La connexion a échoué. Réessaie.';
}
