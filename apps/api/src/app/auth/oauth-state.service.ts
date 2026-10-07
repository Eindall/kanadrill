import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthProvider } from '@kanadrill/shared';

export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

/** Contenu du cookie `kd_oauth_state` : le state anti-CSRF, le fournisseur visé, et le mode du flux. */
export interface OAuthState {
  state: string;
  provider: AuthProvider;
  /** `login` : connexion ou création ; `link` : ajout d'un fournisseur au compte `userId`. */
  mode: 'login' | 'link';
  /** Présent seulement en mode `link` : le compte qui a demandé la liaison. */
  userId?: string;
}

interface StatePayload extends OAuthState {
  purpose?: string;
}

const PURPOSE = 'oauth-state';

/**
 * Signe / vérifie le cookie du flux OAuth. Il est signé avec la même clé que les sessions mais porte un
 * `purpose` : le `jti` d'un jeton de session manque ici, donc l'un ne peut pas passer pour l'autre.
 */
@Injectable()
export class OAuthStateService {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: OAuthState): Promise<string> {
    return this.jwt.signAsync({ ...payload, purpose: PURPOSE }, { expiresIn: OAUTH_STATE_MAX_AGE_MS / 1000 });
  }

  async verify(token: string | undefined): Promise<OAuthState | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<StatePayload>(token);
      if (payload.purpose !== PURPOSE || !payload.state || !payload.provider) return null;
      if (payload.mode !== 'login' && payload.mode !== 'link') return null;
      return { state: payload.state, provider: payload.provider, mode: payload.mode, userId: payload.userId };
    } catch {
      return null;
    }
  }
}
