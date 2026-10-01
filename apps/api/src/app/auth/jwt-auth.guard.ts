import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE } from './session';
import { SessionService } from './session.service';

export type AuthenticatedRequest = Request & { userId: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly session: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException();
    try {
      request.userId = (await this.session.verify(token)).sub;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
