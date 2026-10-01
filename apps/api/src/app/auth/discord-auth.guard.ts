import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { OAUTH_STATE_COOKIE } from './session';
import { SessionService } from './session.service';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Garde Passport pour les deux routes OAuth, avec un `state` anti-CSRF aléatoire gardé dans un cookie.
 * - Route de départ : génère le state, le pose en cookie, et l'envoie à Discord.
 * - Route de retour : vérifie que le state renvoyé par Discord est celui du cookie.
 * En cas d'échec à n'importe quelle étape, l'utilisateur est renvoyé sur /login?error=… (jamais d'erreur JSON brute).
 */
@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  constructor(
    private readonly config: ConfigService,
    private readonly session: SessionService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (this.isCallback(req)) {
      const expected: string | undefined = req.cookies?.[OAUTH_STATE_COOKIE];
      res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
      const received = typeof req.query['state'] === 'string' ? req.query['state'] : undefined;
      if (!expected || !received || !this.safeEqual(received, expected)) {
        return this.fail(res, 'state');
      }
      // Sans `code` (ex. l'utilisateur a refusé l'accès chez Discord), passport-oauth2 relancerait le flux
      // depuis le début : on s'arrête ici pour éviter une boucle de redirections.
      if (typeof req.query['code'] !== 'string') {
        return this.fail(res, 'discord');
      }
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return this.fail(res, 'discord');
    }
  }

  override getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (this.isCallback(req)) return {};

    const state = randomBytes(24).toString('hex');
    http.getResponse<Response>().cookie(OAUTH_STATE_COOKIE, state, this.session.cookieOptions(STATE_MAX_AGE_MS));
    return { state };
  }

  private isCallback(req: Request): boolean {
    return req.path.endsWith('/callback');
  }

  /** Redirige vers la page de connexion et bloque la suite du traitement. */
  private fail(res: Response, code: 'state' | 'discord'): boolean {
    res.redirect(`${this.config.getOrThrow<string>('APP_URL')}/login?error=${code}`);
    return false;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
