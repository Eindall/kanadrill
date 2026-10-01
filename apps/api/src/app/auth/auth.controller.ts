import { Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { type ProviderProfile, UsersService } from '../users/users.service';
import { DiscordAuthGuard } from './discord-auth.guard';
import { SESSION_COOKIE } from './session';
import { SessionService } from './session.service';

@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly session: SessionService,
  ) {}

  /** Départ du flux : le guard redirige vers Discord (le corps de la méthode n'est jamais exécuté). */
  @Get('discord')
  @UseGuards(DiscordAuthGuard)
  login(): void {
    // Redirection assurée par DiscordAuthGuard / Passport.
  }

  /** Retour de Discord : le guard a vérifié le state et échangé le code ; `req.user` est le profil Discord. */
  @Get('discord/callback')
  @UseGuards(DiscordAuthGuard)
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    try {
      const user = await this.users.upsertFromProvider(req.user as ProviderProfile);
      await this.session.start(res, user.id, req.get('user-agent'));
      res.redirect(`${appUrl}/`);
    } catch {
      res.redirect(`${appUrl}/login?error=discord`);
    }
  }

  /** Déconnexion réelle : la session est révoquée en base (le cookie volé ne sert plus), pas seulement effacé. */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.session.logout(req.cookies?.[SESSION_COOKIE], res);
  }
}
