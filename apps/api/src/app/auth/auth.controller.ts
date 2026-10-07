import { Controller, Get, HttpCode, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { type AuthProvider, isAuthProvider, type LinkStartResponse } from '@kanadrill/shared';
import { type ProviderProfile, UsersService } from '../users/users.service';
import { CurrentUserId } from './current-user.decorator';
import { DiscordStrategy } from './discord.strategy';
import { GoogleStrategy } from './google.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { type OAuthRequest, OAuthGuard } from './oauth.guard';
import { OAUTH_STATE_MAX_AGE_MS, OAuthStateService } from './oauth-state.service';
import { OAUTH_STATE_COOKIE, SESSION_COOKIE } from './session';
import { SessionService } from './session.service';
import { randomBytes } from 'node:crypto';

const DiscordGuard = OAuthGuard('discord');
const GoogleGuard = OAuthGuard('google');

@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly session: SessionService,
    private readonly oauthState: OAuthStateService,
    private readonly discord: DiscordStrategy,
    private readonly google: GoogleStrategy,
  ) {}

  /** Départ du flux : le garde redirige vers le fournisseur (le corps de la méthode n'est jamais exécuté). */
  @Get('discord')
  @UseGuards(DiscordGuard)
  loginDiscord(): void {
    // Redirection assurée par OAuthGuard / Passport.
  }

  @Get('google')
  @UseGuards(GoogleGuard)
  loginGoogle(): void {
    // Redirection assurée par OAuthGuard / Passport.
  }

  /** Retour du fournisseur : le garde a vérifié le state et échangé le code ; `req.user` est le profil OAuth. */
  @Get('discord/callback')
  @UseGuards(DiscordGuard)
  callbackDiscord(@Req() req: OAuthRequest, @Res() res: Response): Promise<void> {
    return this.handleCallback('discord', req, res);
  }

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  callbackGoogle(@Req() req: OAuthRequest, @Res() res: Response): Promise<void> {
    return this.handleCallback('google', req, res);
  }

  /**
   * Départ d'une liaison, depuis le profil. C'est un POST authentifié (le cookie `SameSite=Lax` n'accompagne pas un
   * POST venu d'un autre site) : le state est lié au compte connecté, et le retour vérifiera que la session
   * courante est bien la sienne. On renvoie l'URL d'autorisation, vers laquelle le front navigue.
   */
  @Post(':provider/link')
  @UseGuards(JwtAuthGuard)
  async startLink(
    @CurrentUserId() userId: string,
    @Param('provider') provider: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LinkStartResponse> {
    if (!isAuthProvider(provider)) throw new NotFoundException('Fournisseur inconnu');
    const state = randomBytes(24).toString('hex');
    const token = await this.oauthState.sign({ state, provider, mode: 'link', userId });
    res.cookie(OAUTH_STATE_COOKIE, token, this.session.cookieOptions(OAUTH_STATE_MAX_AGE_MS));
    const strategy = provider === 'discord' ? this.discord : this.google;
    return { url: strategy.authorizationUrl(state) };
  }

  /** Déconnexion réelle : la session est révoquée en base (le cookie volé ne sert plus), pas seulement effacé. */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.session.logout(req.cookies?.[SESSION_COOKIE], res);
  }

  private async handleCallback(provider: AuthProvider, req: OAuthRequest, res: Response): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const profile = req.user as ProviderProfile;
    const state = req.oauthState;

    if (state?.mode === 'link') {
      res.redirect(await this.finishLink(profile, state.userId, req, appUrl));
      return;
    }

    try {
      const result = await this.users.signIn(profile);
      if (result.kind === 'account_exists') {
        res.redirect(`${appUrl}/login?error=account_exists&provider=${result.provider}&from=${provider}`);
        return;
      }
      await this.session.start(res, result.user.id, req.get('user-agent'));
      res.redirect(`${appUrl}/`);
    } catch {
      res.redirect(`${appUrl}/login?error=${provider}`);
    }
  }

  /** Liaison : n'aboutit que si la session actuelle est celle du compte qui l'a demandée. Renvoie l'URL de retour. */
  private async finishLink(profile: ProviderProfile, userId: string | undefined, req: Request, appUrl: string): Promise<string> {
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    const current = token ? await this.session.authenticate(token) : null;
    if (!current || !userId || current.userId !== userId) return `${appUrl}/profile?link_error=session`;
    try {
      const result = await this.users.linkIdentity(userId, profile);
      return result === 'linked'
        ? `${appUrl}/profile?linked=${profile.provider}`
        : `${appUrl}/profile?link_error=${result}`;
    } catch {
      return `${appUrl}/profile?link_error=provider`;
    }
  }
}
