import { CanActivate, ExecutionContext, Injectable, Logger, Type, mixin } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthProvider } from '@kanadrill/shared';
import { OAuthState, OAuthStateService, OAUTH_STATE_MAX_AGE_MS } from './oauth-state.service';
import { OAUTH_STATE_COOKIE } from './session';
import { SessionService } from './session.service';

/** Requête enrichie par le garde au retour du fournisseur : le contenu vérifié du cookie de state. */
export type OAuthRequest = Request & { oauthState?: OAuthState };

/**
 * Garde Passport d'un fournisseur OAuth, avec un `state` anti-CSRF aléatoire gardé dans un cookie signé.
 * - Route de départ : génère le state, le pose en cookie (mode `login`), et l'envoie au fournisseur.
 * - Route de retour : vérifie la signature du cookie, que le state renvoyé est celui du cookie et que le cookie
 *   a été émis pour ce fournisseur ; expose le contenu vérifié dans `req.oauthState` (mode `link` compris :
 *   la vérification de la session de l'utilisateur est faite par le contrôleur).
 * En cas d'échec à n'importe quelle étape, l'utilisateur est renvoyé sur /login?error=… (jamais d'erreur JSON brute).
 */
export function OAuthGuard(provider: AuthProvider): Type<CanActivate> {
  @Injectable()
  class OAuthGuardMixin extends AuthGuard(provider) {
    private readonly logger = new Logger(`OAuthGuard(${provider})`);

    constructor(
      private readonly config: ConfigService,
      private readonly session: SessionService,
      private readonly oauthState: OAuthStateService,
    ) {
      super();
    }

    override async canActivate(context: ExecutionContext): Promise<boolean> {
      const http = context.switchToHttp();
      const req = http.getRequest<OAuthRequest>();
      const res = http.getResponse<Response>();

      if (this.isCallback(req)) {
        const expected = await this.oauthState.verify(req.cookies?.[OAUTH_STATE_COOKIE]);
        res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
        const received = typeof req.query['state'] === 'string' ? req.query['state'] : undefined;
        if (!expected || expected.provider !== provider || !received || !this.safeEqual(received, expected.state)) {
          return this.fail(res, 'state', expected?.mode);
        }
        req.oauthState = expected;
        // Sans `code` (ex. l'utilisateur a refusé l'accès chez le fournisseur), passport-oauth2 relancerait le flux
        // depuis le début : on s'arrête ici pour éviter une boucle de redirections.
        if (typeof req.query['code'] !== 'string') {
          this.logger.warn(`Retour sans code : error=${String(req.query['error'])}`);
          return this.fail(res, provider, expected.mode);
        }
      }

      try {
        if (!this.isCallback(req)) await this.prepareStart(context);
        return (await super.canActivate(context)) as boolean;
      } catch (error) {
        const detail = error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(`Échec de l'authentification : ${detail}`);
        return this.fail(res, provider, req.oauthState?.mode);
      }
    }

    override getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
      const http = context.switchToHttp();
      const req = http.getRequest<Request>();
      if (this.isCallback(req)) return {};

      return { state: (req as Request & { pendingState?: string }).pendingState };
    }

    /** Départ : signe le cookie de state (asynchrone), ce que `getAuthenticateOptions` (synchrone) ne peut pas faire. */
    private async prepareStart(context: ExecutionContext): Promise<void> {
      const http = context.switchToHttp();
      const req = http.getRequest<Request & { pendingState?: string }>();
      const state = randomBytes(24).toString('hex');
      req.pendingState = state;
      const token = await this.oauthState.sign({ state, provider, mode: 'login' });
      http.getResponse<Response>().cookie(OAUTH_STATE_COOKIE, token, this.session.cookieOptions(OAUTH_STATE_MAX_AGE_MS));
    }

    private isCallback(req: Request): boolean {
      return req.path.endsWith('/callback');
    }

    /** Redirige vers la page de connexion (ou le profil en mode liaison) et bloque la suite du traitement. */
    private fail(res: Response, code: string, mode?: 'login' | 'link'): boolean {
      const appUrl = this.config.getOrThrow<string>('APP_URL');
      res.redirect(
        mode === 'link'
          ? `${appUrl}/profile?link_error=${code === 'state' ? 'state' : 'provider'}`
          : `${appUrl}/login?error=${code}`,
      );
      return false;
    }

    private safeEqual(a: string, b: string): boolean {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
    }
  }
  return mixin(OAuthGuardMixin);
}
