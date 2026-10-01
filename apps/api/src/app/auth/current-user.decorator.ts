import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/** Injecte l'ID de l'utilisateur connecté (à utiliser derrière JwtAuthGuard). */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().userId;
});

/** Injecte l'ID de la session courante (le `jti` du cookie), derrière JwtAuthGuard. */
export const CurrentSessionId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().sessionId;
});
