import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from './session';

export interface SessionPayload {
  sub: string;
}

/**
 * Session = JWT signé dans un cookie httpOnly. Pas de stockage serveur : simple à héberger.
 * Compromis : on ne peut pas révoquer une session avant son expiration (acceptable ici).
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async start(res: Response, userId: string): Promise<void> {
    const token = await this.jwt.signAsync({ sub: userId } satisfies SessionPayload);
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(SESSION_MAX_AGE_MS));
  }

  end(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  async verify(token: string): Promise<SessionPayload> {
    return this.jwt.verifyAsync<SessionPayload>(token);
  }

  cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE') === 'true',
      path: '/',
      maxAge,
    };
  }
}
