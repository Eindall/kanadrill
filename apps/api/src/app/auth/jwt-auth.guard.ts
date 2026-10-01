import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SESSION_COOKIE } from './session';
import { SessionService } from './session.service';

export type AuthenticatedRequest = Request & { userId: string; sessionId: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly session: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const token: string | undefined = request.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException();

    const auth = await this.session.authenticate(token);
    if (!auth) throw new UnauthorizedException();

    request.userId = auth.userId;
    request.sessionId = auth.sessionId;
    // Session prolongée : on réémet le cookie, sinon le navigateur le supprimerait à l'ancienne échéance.
    if (auth.renewedUntil) this.session.setCookie(http.getResponse<Response>(), token, auth.renewedUntil);
    return true;
  }
}
