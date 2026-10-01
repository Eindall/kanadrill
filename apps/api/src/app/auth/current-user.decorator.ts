import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/** Injecte l'ID de l'utilisateur connecté (à utiliser derrière JwtAuthGuard). */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().userId;
});
