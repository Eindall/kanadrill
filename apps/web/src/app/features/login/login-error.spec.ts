import { loginErrorMessage } from './login-error';

describe('loginErrorMessage', () => {
  it("n'affiche rien sans erreur", () => {
    expect(loginErrorMessage(undefined)).toBeNull();
  });

  it('account_exists nomme les deux fournisseurs', () => {
    expect(loginErrorMessage('account_exists', 'discord', 'google')).toBe(
      'Un compte KanaDrill existe déjà avec cette adresse. Connecte-toi avec Discord, puis ajoute Google depuis ton profil.',
    );
  });

  it("ignore un fournisseur qui n'existe pas (paramètre d'URL non fiable)", () => {
    const message = loginErrorMessage('account_exists', '<img src=x>', 'evil');
    expect(message).not.toContain('<');
    expect(message).toContain('ton autre fournisseur');
    expect(loginErrorMessage('account_exists', 'discord', 'evil')).toContain('ce fournisseur');
  });

  it('message par fournisseur, générique sinon', () => {
    expect(loginErrorMessage('google')).toContain('Google');
    expect(loginErrorMessage('inconnu')).toBe('La connexion a échoué. Réessaie.');
  });
});
