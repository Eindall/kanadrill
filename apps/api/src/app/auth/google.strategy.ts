import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-oauth2';
import type { ProviderProfile } from '../users/users.service';
import { hashEmail } from './email-hash';
import { buildAuthorizationUrl } from './oauth-url';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPE = ['openid', 'profile', 'email'];

interface GoogleUser {
  sub: string;
  name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * Stratégie Passport pour Google (OAuth2 + OpenID Connect, scopes `openid profile email`).
 * `providerId` = `sub` (immuable, contrairement à l'e-mail). L'e-mail ne sert qu'à calculer une empreinte.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly clientId: string;
  private readonly redirectUri: string;
  private readonly emailHashKey: string;

  constructor(config: ConfigService) {
    const clientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
    super({
      authorizationURL: AUTHORIZE_URL,
      tokenURL: TOKEN_URL,
      clientID: clientId,
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: redirectUri,
      scope: SCOPE,
    });
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.emailHashKey = config.getOrThrow<string>('EMAIL_HASH_KEY');
  }

  /** `select_account` : laisse choisir le compte Google (`prompt=none` échouerait sans session Google active). */
  override authorizationParams(): Record<string, string> {
    return { prompt: 'select_account' };
  }

  /** URL de départ d'une liaison (le flux de connexion passe, lui, par Passport). */
  authorizationUrl(state: string): string {
    return buildAuthorizationUrl(AUTHORIZE_URL, {
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      scope: SCOPE,
      state,
      extra: this.authorizationParams(),
    });
  }

  override userProfile(accessToken: string, done: (err?: Error | null, profile?: unknown) => void): void {
    fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`google_profile_failed: HTTP ${response.status}`);
        return (await response.json()) as GoogleUser;
      })
      .then((me) => done(null, me))
      .catch((error: unknown) => done(error instanceof Error ? error : new Error('google_profile_failed')));
  }

  validate(_accessToken: string, _refreshToken: string, me: GoogleUser, done: VerifyCallback): void {
    const profile: ProviderProfile = {
      provider: 'google',
      providerId: me.sub,
      displayName: me.name ?? 'Apprenant',
      avatarUrl: me.picture ?? null,
      emailHash: hashEmail(me.email, me.email_verified, this.emailHashKey),
    };
    done(null, profile);
  }
}
