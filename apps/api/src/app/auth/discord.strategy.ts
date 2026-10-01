import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-oauth2';
import type { ProviderProfile } from '../users/users.service';

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const ME_URL = 'https://discord.com/api/users/@me';

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

/**
 * Stratégie Passport pour Discord (OAuth2 « authorization code », scope `identify` : pas d'e-mail).
 * Le `state` anti-CSRF n'est pas géré par la lib (elle exigerait une session serveur) : voir DiscordAuthGuard.
 */
@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(config: ConfigService) {
    super({
      authorizationURL: AUTHORIZE_URL,
      tokenURL: TOKEN_URL,
      clientID: config.getOrThrow<string>('DISCORD_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('DISCORD_REDIRECT_URI'),
      scope: ['identify'],
    });
  }

  /** `prompt=none` : si l'utilisateur a déjà autorisé l'app, Discord ne redemande pas son accord. */
  override authorizationParams(): Record<string, string> {
    return { prompt: 'none' };
  }

  /** Appelé par passport-oauth2 après l'échange du code : récupère le profil auprès de Discord. */
  override userProfile(accessToken: string, done: (err?: Error | null, profile?: unknown) => void): void {
    // `_oauth2` est l'attribut interne de passport-oauth2 (pas d'API publique pour un GET authentifié).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any)._oauth2.get(ME_URL, accessToken, (error: unknown, body?: string) => {
      if (error || !body) return done(new Error('discord_profile_failed'));
      try {
        done(null, JSON.parse(body) as DiscordUser);
      } catch {
        done(new Error('discord_profile_invalid'));
      }
    });
  }

  /** Transforme le profil Discord en profil applicatif ; le résultat devient `req.user`. */
  validate(_accessToken: string, _refreshToken: string, me: DiscordUser, done: VerifyCallback): void {
    const profile: ProviderProfile = {
      provider: 'discord',
      providerId: me.id,
      displayName: me.global_name ?? me.username,
      avatarUrl: this.avatarUrl(me),
    };
    done(null, profile);
  }

  /** Avatar perso si défini, sinon l'avatar par défaut de Discord (dérivé de l'ID). */
  private avatarUrl(me: DiscordUser): string {
    if (me.avatar) {
      return `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256`;
    }
    const index = Number((BigInt(me.id) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
}
